import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

const KEEP = 5;

export async function snapshotBeforeMigrate(
  pg: PGlite,
  dataDir: string
): Promise<string> {
  const dump = await pg.dumpDataDir("gzip");
  const dir = join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const path = join(dir, `pre-migrate-${stamp}.tar.gz`);
  writeFileSync(path, Buffer.from(await dump.arrayBuffer()));
  // ISO timestamps sort in time order.
  const snapshots = readdirSync(dir)
    .filter((file) => /^pre-migrate-.*\.tar\.gz$/.test(file))
    .sort();
  for (const file of snapshots.slice(0, -KEEP)) rmSync(join(dir, file));
  return path;
}
