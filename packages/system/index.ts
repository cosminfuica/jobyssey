import type { AccountId } from "@jobyssey/accounts";
import type { DbDriver } from "@jobyssey/db";
import type { SystemStatus } from "./shared.ts";

export function getSystemStatus(input: {
  version: string;
  driver: DbDriver;
  accountId: AccountId;
}): SystemStatus {
  return {
    name: "Jobyssey",
    version: input.version,
    node: process.version,
    database: { driver: input.driver },
    accountId: input.accountId,
  };
}
