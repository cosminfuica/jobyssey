import { fileURLToPath } from "node:url";
import type { MigrationSet } from "./lib/migrate.ts";

export { acquireDataDirLock, DataDirLockedError } from "./lib/lock.ts";
export { migrateDatabase, type MigrationSet } from "./lib/migrate.ts";
export {
  openDatabase,
  type DatabaseHandle,
  type Db,
  type DbDriver,
} from "./lib/open.ts";

export const coreMigrations: MigrationSet = {
  name: "core",
  folder: fileURLToPath(new URL("./migrations", import.meta.url)),
  table: "__drizzle_migrations",
};

// Tables without account_id; keep in step with "sharedTables" in workspace-policy.json.
export const SHARED_TABLES: ReadonlySet<string> = new Set(["accounts"]);
