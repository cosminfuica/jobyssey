import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { clients, type DatabaseHandle, type Db } from "./open.ts";
import { snapshotBeforeMigrate } from "./snapshot.ts";

export type MigrationSet = {
  readonly name: string;
  readonly folder: string;
  readonly table: string;
};

// Any fixed number works; it only has to be the same in every Jobyssey process.
const ADVISORY_LOCK = 727001;

function journalEntries(set: MigrationSet): number {
  const file = join(set.folder, "meta", "_journal.json");
  let journal: { entries?: unknown };
  try {
    journal = JSON.parse(readFileSync(file, "utf8")) as { entries?: unknown };
  } catch (error) {
    throw new Error(
      `Migration set ${set.name}: cannot read meta/_journal.json in ${set.folder}`,
      { cause: error }
    );
  }
  if (!Array.isArray(journal.entries))
    throw new Error(`Migration set ${set.name}: ${file} has no entries array`);
  return journal.entries.length;
}

async function appliedRows(db: Db, table: string): Promise<number> {
  const [exists] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sql`information_schema.tables`)
    .where(sql`table_schema = 'drizzle' and table_name = ${table}`);
  if (!exists?.n) return 0;
  const [rows] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sql`${sql.identifier("drizzle")}.${sql.identifier(table)}`);
  return rows?.n ?? 0;
}

export async function migrateDatabase(
  handle: DatabaseHandle,
  options: { sets: readonly MigrationSet[]; log?: (message: string) => void }
): Promise<{ applied: number; snapshot?: string }> {
  // Drizzle compares a migration's timestamp only with the newest row of its own table, so sets must never share one.
  const tables = new Set<string>();
  for (const set of options.sets) {
    if (tables.has(set.table))
      throw new Error(`Migration sets share the table ${set.table}`);
    tables.add(set.table);
  }
  const client = clients.get(handle);
  if (client === undefined)
    throw new Error("migrateDatabase needs a handle from openDatabase");
  const log = options.log ?? (() => {});
  // Drizzle takes no lock: hold a session advisory lock on one dedicated connection so concurrent servers migrate one at a time.
  const lockClient =
    client.driver === "postgres" ? await client.pool.connect() : undefined;
  try {
    if (lockClient !== undefined)
      await lockClient.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK})`);
    const pending: number[] = [];
    for (const set of options.sets)
      pending.push(
        Math.max(
          0,
          journalEntries(set) - (await appliedRows(handle.db, set.table))
        )
      );
    const applied = pending.reduce((sum, n) => sum + n, 0);
    let snapshot: string | undefined;
    if (
      applied > 0 &&
      client.driver === "pglite" &&
      handle.dataDir !== undefined &&
      !handle.fresh
    )
      snapshot = await snapshotBeforeMigrate(client.pg, handle.dataDir);
    for (const [index, set] of options.sets.entries()) {
      const config = {
        migrationsFolder: set.folder,
        migrationsTable: set.table,
      };
      if (client.driver === "pglite") await migratePglite(client.db, config);
      else await migratePg(client.db, config);
      log(`migrations: set ${set.name} applied ${pending[index] ?? 0}`);
    }
    return { applied, snapshot };
  } finally {
    if (lockClient !== undefined) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK})`);
      } finally {
        lockClient.release();
      }
    }
  }
}
