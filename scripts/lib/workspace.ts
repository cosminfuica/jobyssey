import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const FIXED_SCOPES = [
  "repo",
  "deps",
  "docs",
  "github",
  "release",
] as const;

export function matchWorkspaceFolders(root: string): string[] {
  const manifest = parse(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")
  ) as { packages?: string[] };
  const globs = manifest.packages ?? [];
  const include = globs.filter((glob) => !glob.startsWith("!"));
  const exclude = globs
    .filter((glob) => glob.startsWith("!"))
    .map((glob) => glob.slice(1));
  return globSync(include, { cwd: root, exclude })
    .filter((folder) => statSync(join(root, folder)).isDirectory())
    .sort();
}

export function listWorkspaceDirs(root: string): string[] {
  return matchWorkspaceFolders(root).filter((folder) =>
    existsSync(join(root, folder, "package.json"))
  );
}
