import type { Db } from "@jobyssey/db";
import { asc, eq, sql } from "drizzle-orm";
import { accounts } from "./schema.ts";

export type AccountId = string & { readonly __brand: "AccountId" };

// Any fixed number works; it only has to differ from the migration lock in @jobyssey/db.
const BOOTSTRAP_LOCK = 727002;

export async function ensureSingleAccount(db: Db): Promise<AccountId> {
  // The transaction-scoped advisory lock keeps two servers starting together from creating two accounts.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`);
    const [oldest] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .orderBy(asc(accounts.createdAt), asc(accounts.id))
      .limit(1);
    if (oldest !== undefined) return oldest.id as AccountId;
    const [created] = await tx
      .insert(accounts)
      .values({})
      .returning({ id: accounts.id });
    if (created === undefined)
      throw new Error("accounts insert returned no row");
    return created.id as AccountId;
  });
}

export async function getAccount(
  db: Db,
  id: AccountId
): Promise<{ id: AccountId; createdAt: Date } | undefined> {
  const [row] = await db
    .select({ id: accounts.id, createdAt: accounts.createdAt })
    .from(accounts)
    .where(eq(accounts.id, id));
  return row === undefined
    ? undefined
    : { id: row.id as AccountId, createdAt: row.createdAt };
}

/** @public - consumed by login adapters in other workspaces */
export async function createAccount(db: Db): Promise<AccountId> {
  const [created] = await db
    .insert(accounts)
    .values({})
    .returning({ id: accounts.id });
  if (created === undefined) throw new Error("accounts insert returned no row");
  return created.id as AccountId;
}
