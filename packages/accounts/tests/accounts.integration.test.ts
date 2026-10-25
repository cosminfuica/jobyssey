import { randomBytes } from "node:crypto";
import {
  coreMigrations,
  migrateDatabase,
  openDatabase,
  type DatabaseHandle,
} from "@jobyssey/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createAccount, ensureSingleAccount, getAccount } from "../index.ts";
import { accounts } from "../schema.ts";

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

async function rowCount(): Promise<number> {
  const [row] = await handle.db
    .select({ n: sql<number>`count(*)::int` })
    .from(accounts);
  return row?.n ?? 0;
}

test(
  "ensureSingleAccount creates one account and then returns it",
  { timeout: TIMEOUT },
  async () => {
    const first = await ensureSingleAccount(handle.db);
    const second = await ensureSingleAccount(handle.db);
    expect(second).toBe(first);
    expect(await rowCount()).toBe(1);
    const account = await getAccount(handle.db, first);
    expect(account?.id).toBe(first);
    expect(account?.createdAt).toBeInstanceOf(Date);

    const other = await createAccount(handle.db);
    expect(other).not.toBe(first);
    expect((await getAccount(handle.db, first))?.id).toBe(first);
    expect((await getAccount(handle.db, other))?.id).toBe(other);
    expect(await rowCount()).toBe(2);
    expect(await ensureSingleAccount(handle.db)).toBe(first);
  }
);
