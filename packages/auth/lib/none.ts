import { ensureSingleAccount } from "@jobyssey/accounts";
import type { Db } from "@jobyssey/db";
import type { AuthAdapter } from "../index.ts";

export async function createNone(deps: { db: Db }): Promise<AuthAdapter> {
  const id = await ensureSingleAccount(deps.db);
  return { name: "none", resolveAccount: () => Promise.resolve(id) };
}
