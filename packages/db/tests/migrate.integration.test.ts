import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  DataDirLockedError,
  migrateDatabase,
  openDatabase,
  type DatabaseHandle,
  type Db,
  type MigrationSet,
} from "../index.ts";

// PGlite boots a WebAssembly Postgres per open; generous so a loaded machine cannot fail it.
const TIMEOUT = 60_000;

const fixture = (name: string) => join(import.meta.dirname, "fixtures", name);
const v1: MigrationSet = {
  name: "core",
  folder: fixture("migrations-v1"),
  table: "__drizzle_migrations",
};
const v2: MigrationSet = { ...v1, folder: fixture("migrations-v2") };
const extra: MigrationSet = {
  name: "extra",
  folder: fixture("migrations-extra"),
  table: "__drizzle_migrations_extra",
};

async function count(db: Db, table: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sql`${sql.identifier("drizzle")}.${sql.identifier(table)}`);
  return row?.n ?? 0;
}

async function tables(db: Db): Promise<string[]> {
  const rows = await db
    .select({ name: sql<string>`table_name` })
    .from(sql`information_schema.tables`)
    .where(sql`table_schema = 'public'`)
    .orderBy(sql`table_name`);
  return rows.map((row) => row.name);
}

describe.runIf(process.env.TEST_DB === "pglite")("PGlite", () => {
  let dataDir: string;
  const dirs: string[] = [];
  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "jby-db-"));
  });
  afterAll(() => {
    for (const dir of [dataDir, ...dirs])
      rmSync(dir, { recursive: true, force: true });
  });

  // A persisted folder migrated to v1 and closed, so the next open is not fresh.
  async function migratedFolder(): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "jby-db-"));
    dirs.push(dir);
    const handle = await openDatabase({ dataDir: dir });
    try {
      await migrateDatabase(handle, { sets: [v1] });
    } finally {
      await handle.close();
    }
    return dir;
  }

  test(
    "migrates a fresh folder, then snapshots before the next migrations",
    { timeout: TIMEOUT },
    async () => {
      const first = await openDatabase({ dataDir });
      try {
        expect(first.fresh).toBe(true);
        expect(await migrateDatabase(first, { sets: [v1] })).toEqual({
          applied: 1,
          snapshot: undefined,
        });
      } finally {
        await first.close();
      }

      const second = await openDatabase({ dataDir });
      try {
        expect(second.fresh).toBe(false);
        const logs: string[] = [];
        const result = await migrateDatabase(second, {
          sets: [v2, extra],
          log: (message) => logs.push(message),
        });
        expect(result.applied).toBe(2);
        expect(result.snapshot).toMatch(/pre-migrate-.*\.tar\.gz$/);
        expect(existsSync(result.snapshot ?? "")).toBe(true);
        expect(logs).toEqual([
          "migrations: set core applied 1",
          "migrations: set extra applied 1",
        ]);
        expect(await count(second.db, "__drizzle_migrations")).toBe(2);
        expect(await count(second.db, "__drizzle_migrations_extra")).toBe(1);
        expect(await tables(second.db)).toEqual([
          "probe_a",
          "probe_b",
          "probe_c",
        ]);
        await expect(
          migrateDatabase(second, { sets: [v2, { ...extra, table: v2.table }] })
        ).rejects.toThrow("Migration sets share the table");
      } finally {
        await second.close();
      }
    }
  );

  test(
    "opening the same folder twice concurrently throws DataDirLockedError",
    { timeout: TIMEOUT },
    async () => {
      const results = await Promise.allSettled([
        openDatabase({ dataDir }),
        openDatabase({ dataDir }),
      ]);
      const opened = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : []
      );
      const failed = results.flatMap((r) =>
        r.status === "rejected" ? [r.reason as unknown] : []
      );
      for (const handle of opened) await handle.close();
      expect(opened).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0]).toBeInstanceOf(DataDirLockedError);
    }
  );

  test(
    "a snapshot prunes the older ones so the 5 newest remain",
    { timeout: TIMEOUT },
    async () => {
      const dir = await migratedFolder();
      const backups = join(dir, "backups");
      mkdirSync(backups);
      const old = [1, 2, 3, 4, 5, 6].map(
        (day) => `pre-migrate-2000-01-0${day}T00-00-00.000Z.tar.gz`
      );
      for (const file of old) writeFileSync(join(backups, file), "");
      const handle = await openDatabase({ dataDir: dir });
      try {
        const { snapshot } = await migrateDatabase(handle, { sets: [v2] });
        expect(readdirSync(backups).sort()).toEqual([
          ...old.slice(-4),
          basename(snapshot ?? ""),
        ]);
      } finally {
        await handle.close();
      }
    }
  );

  test(
    "no snapshot is taken when no migration is pending",
    { timeout: TIMEOUT },
    async () => {
      const dir = await migratedFolder();
      const handle = await openDatabase({ dataDir: dir });
      try {
        expect(handle.fresh).toBe(false);
        expect(await migrateDatabase(handle, { sets: [v1] })).toEqual({
          applied: 0,
          snapshot: undefined,
        });
        expect(existsSync(join(dir, "backups"))).toBe(false);
      } finally {
        await handle.close();
      }
    }
  );
});

describe.runIf(process.env.TEST_DB === "postgres")("Postgres", () => {
  const name = `jobyssey_test_${randomBytes(6).toString("hex")}`;
  let admin: DatabaseHandle;
  let url: string;
  beforeAll(async () => {
    const base = process.env.DATABASE_URL ?? "";
    admin = await openDatabase({ dataDir: "memory://", databaseUrl: base });
    await admin.db.execute(sql.raw(`CREATE DATABASE "${name}"`));
    const parsed = new URL(base);
    parsed.pathname = `/${name}`;
    url = parsed.toString();
  }, TIMEOUT);
  afterAll(async () => {
    await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}"`));
    await admin.close();
  }, TIMEOUT);

  test(
    "two concurrent migrations apply each migration once",
    { timeout: TIMEOUT },
    async () => {
      const a = await openDatabase({ dataDir: "memory://", databaseUrl: url });
      const b = await openDatabase({ dataDir: "memory://", databaseUrl: url });
      const handles = [a, b];
      try {
        const results = await Promise.all(
          handles.map((handle) =>
            migrateDatabase(handle, { sets: [v2, extra] })
          )
        );
        expect(results.map((r) => r.applied).sort((x, y) => x - y)).toEqual([
          0, 3,
        ]);
        expect(await count(a.db, "__drizzle_migrations")).toBe(2);
        expect(await count(a.db, "__drizzle_migrations_extra")).toBe(1);
      } finally {
        for (const handle of handles) await handle.close();
      }
    }
  );

  test(
    "the migration advisory lock is released after migrating",
    { timeout: TIMEOUT },
    async () => {
      // Its own database: advisory locks are per database, so a lock another test left cannot block this one.
      const own = `${name}_unlock`;
      await admin.db.execute(sql.raw(`CREATE DATABASE "${own}"`));
      const parsed = new URL(url);
      parsed.pathname = `/${own}`;
      const handle = await openDatabase({
        dataDir: "memory://",
        databaseUrl: parsed.toString(),
      });
      try {
        await migrateDatabase(handle, { sets: [v2, extra] });
        // The lock is held by a session that goes back to the pool and stays connected, so a missing unlock shows here.
        const [row] = await handle.db
          .select({ n: sql<number>`count(*)::int` })
          .from(sql`pg_locks`)
          .where(
            sql`locktype = 'advisory' and objid = 727001 and database = (select oid from pg_database where datname = current_database())`
          );
        expect(row?.n).toBe(0);
      } finally {
        await handle.close();
        await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${own}"`));
      }
    }
  );
});
