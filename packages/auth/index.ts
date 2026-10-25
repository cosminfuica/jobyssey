import type { AccountId } from "@jobyssey/accounts";
import type { Db } from "@jobyssey/db";
import type { Hono } from "hono";
import { createNone } from "./lib/none.ts";

export type AuthAdapter = {
  readonly name: string;
  resolveAccount(request: Request): Promise<AccountId>;
  // Mounted by the shell at /api/auth, for login methods that need callbacks.
  readonly routes?: Hono;
};

export function createNoneAdapter(deps: { db: Db }): Promise<AuthAdapter> {
  return createNone(deps);
}
