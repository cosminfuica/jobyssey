import { existsSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { acquireDataDirLock } from "./lock.ts";

export type DbDriver = "pglite" | "postgres";

// The base type both drizzle-orm/pglite and drizzle-orm/node-postgres instances satisfy.
export type Db = PgDatabase<PgQueryResultHKT>;

export type DatabaseHandle = {
  db: Db;
  driver: DbDriver;
  dataDir?: string;
  fresh: boolean;
  close(): Promise<void>;
};

type Client =
  | { driver: "pglite"; pg: PGlite; db: PgliteDatabase }
  | { driver: "postgres"; pool: Pool; db: NodePgDatabase };

// The driver-specific client behind each handle, for migrations and snapshots.
export const clients = new WeakMap<DatabaseHandle, Client>();

function register(handle: DatabaseHandle, client: Client): DatabaseHandle {
  clients.set(handle, client);
  return handle;
}

export async function openDatabase(options: {
  dataDir: string;
  databaseUrl?: string;
}): Promise<DatabaseHandle> {
  if (options.databaseUrl !== undefined) {
    const pool = new Pool({ connectionString: options.databaseUrl });
    const db = drizzlePg({ client: pool });
    return register(
      { db, driver: "postgres", fresh: false, close: () => pool.end() },
      { driver: "postgres", pool, db }
    );
  }
  if (options.dataDir === "memory://") {
    const pg = new PGlite("memory://");
    await pg.waitReady;
    const db = drizzlePglite({ client: pg });
    return register(
      { db, driver: "pglite", fresh: true, close: () => pg.close() },
      { driver: "pglite", pg, db }
    );
  }
  const { dataDir } = options;
  const release = acquireDataDirLock(dataDir);
  try {
    const pgdata = join(dataDir, "pgdata");
    const fresh = !existsSync(pgdata);
    const pg = new PGlite(pgdata);
    await pg.waitReady;
    const db = drizzlePglite({ client: pg });
    const close = async () => {
      try {
        await pg.close();
      } finally {
        release();
      }
    };
    return register(
      { db, driver: "pglite", dataDir, fresh, close },
      { driver: "pglite", pg, db }
    );
  } catch (error) {
    release();
    throw error;
  }
}
