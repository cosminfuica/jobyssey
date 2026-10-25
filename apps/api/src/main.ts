import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runApiOrExit } from "@jobyssey/api-shell/server";
import { createNoneAdapter } from "@jobyssey/auth";
import { coreMigrations } from "@jobyssey/db";
import { createCoreFeatures } from "@jobyssey/registry/server";

const rootPackage = join(import.meta.dirname, "../../../package.json");
const { version } = JSON.parse(readFileSync(rootPackage, "utf8")) as {
  version: string;
};
const webDist = join(import.meta.dirname, "../../web/dist");
await runApiOrExit({
  env: process.env,
  version,
  webDist,
  migrationSets: [coreMigrations],
  createAuth: createNoneAdapter,
  createFeatures: createCoreFeatures,
});
