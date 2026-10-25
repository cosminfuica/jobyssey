import { randomBytes } from "node:crypto";
import { getAccount } from "@jobyssey/accounts";
import {
  coreMigrations,
  migrateDatabase,
  openDatabase,
  type DatabaseHandle,
} from "@jobyssey/db";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createNoneAdapter } from "../index.ts";

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
    await admin.db.execute(`CREATE DATABASE "${name}"`);
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
    await admin.db.execute(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.close();
  }
}, TIMEOUT);

test(
  "the none adapter maps every request to the install's one account",
  { timeout: TIMEOUT },
  async () => {
    const adapter = await createNoneAdapter({ db: handle.db });
    const first = await adapter.resolveAccount(
      new Request("http://localhost/one")
    );
    const second = await adapter.resolveAccount(
      new Request("http://localhost/two", {
        method: "POST",
        headers: { cookie: "session=other" },
      })
    );
    expect(second).toBe(first);
    expect(adapter.name).toBe("none");
    expect((await getAccount(handle.db, first))?.id).toBe(first);
    expect(adapter.routes).toBeUndefined();
  }
);
