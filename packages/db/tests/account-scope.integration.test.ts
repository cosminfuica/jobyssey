import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  coreMigrations,
  migrateDatabase,
  openDatabase,
  SHARED_TABLES,
  type DatabaseHandle,
  type Db,
} from "../index.ts";

// PGlite boots a WebAssembly Postgres per open; generous so a loaded machine cannot fail it.
const TIMEOUT = 60_000;

// One migrated database per file: in-memory PGlite, or a throwaway database on the TEST_DATABASE_URL server.
let handle: DatabaseHandle;
let admin: DatabaseHandle | undefined;
const name = `jobyssey_test_${randomBytes(6).toString("hex")}`;

beforeAll(async () => {
  if (process.env.TEST_DB === "postgres") {
    const base = process.env.DATABASE_URL ?? "";
    admin = await openDatabase({ dataDir: "memory://", databaseUrl: base });
    await admin.db.execute(sql.raw(`CREATE DATABASE "${name}"`));
    const url = new URL(base);
    url.pathname = `/${name}`;
    handle = await openDatabase({
      dataDir: "memory://",
      databaseUrl: url.toString(),
    });
  } else {
    handle = await openDatabase({ dataDir: "memory://" });
  }
  await migrateDatabase(handle, { sets: [coreMigrations] });
}, TIMEOUT);

afterAll(async () => {
  await handle.close();
  if (admin !== undefined) {
    await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}"`));
    await admin.close();
  }
}, TIMEOUT);

// Tables in "public" that are not shared and lack account_id NOT NULL with a foreign key to accounts(id).
async function findUnscopedTables(db: Db): Promise<string[]> {
  const rows = await db
    .select({ name: sql<string>`t.table_name` })
    .from(sql`information_schema.tables t`)
    .where(
      sql`
      t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        JOIN pg_constraint k
          ON k.contype = 'f'
          AND k.conrelid = format('%I.%I', c.table_schema, c.table_name)::regclass
          AND k.confrelid = to_regclass('public.accounts')
          AND k.conkey = ARRAY[(
            SELECT a.attnum FROM pg_attribute a
            WHERE a.attrelid = k.conrelid AND a.attname = 'account_id'
          )]
          AND k.confkey = ARRAY[(
            SELECT a.attnum FROM pg_attribute a
            WHERE a.attrelid = k.confrelid AND a.attname = 'id'
          )]
        WHERE c.table_schema = 'public'
          AND c.table_name = t.table_name
          AND c.column_name = 'account_id'
          AND c.is_nullable = 'NO'
      )`
    )
    .orderBy(sql`t.table_name`);
  return rows
    .map((row) => row.name)
    .filter((table) => !SHARED_TABLES.has(table));
}

test(
  "every migrated table is shared or scoped to an account",
  { timeout: TIMEOUT },
  async () => {
    expect(await findUnscopedTables(handle.db)).toEqual([]);
  }
);

test(
  "a table without account_id is reported",
  { timeout: TIMEOUT },
  async () => {
    await handle.db.execute(sql`CREATE TABLE zz_unscoped (id int)`);
    expect(await findUnscopedTables(handle.db)).toEqual(["zz_unscoped"]);
  }
);

// toContain: tables from the tests above persist in the shared handle.
test(
  "a table with a nullable account_id is reported",
  { timeout: TIMEOUT },
  async () => {
    await handle.db.execute(
      sql`CREATE TABLE zz_nullable (account_id uuid REFERENCES accounts(id))`
    );
    expect(await findUnscopedTables(handle.db)).toContain("zz_nullable");
  }
);

test(
  "a table whose account_id has no foreign key is reported",
  { timeout: TIMEOUT },
  async () => {
    await handle.db.execute(
      sql`CREATE TABLE zz_no_fk (account_id uuid NOT NULL)`
    );
    expect(await findUnscopedTables(handle.db)).toContain("zz_no_fk");
  }
);
