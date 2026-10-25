import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { listWorkspaceDirs } from "./workspace.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jby-workspace-"));
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "!packages/zz-*"\n'
  );
  for (const folder of ["apps/api", "packages/db", "packages/zz-skip"]) {
    mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, folder, "package.json"), "{}\n");
  }
  mkdirSync(join(root, "packages/no-manifest"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("lists workspace folders with a package.json, minus negated globs", () => {
  expect(listWorkspaceDirs(root)).toEqual(["apps/api", "packages/db"]);
});
