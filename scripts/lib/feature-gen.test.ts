import {
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  generateFeature,
  insertAboveMarker,
  renameFeature,
  toNames,
  validateFeatureName,
} from "./feature-gen.ts";

const repo = join(import.meta.dirname, "../..");
// Copies a package tree; generous so a loaded machine cannot fail it.
const TIMEOUT = 30_000;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jby-feature-gen-"));
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n  - "packages/*"\n  - "tooling/*"\n'
  );
  cpSync(
    join(repo, "workspace-policy.json"),
    join(root, "workspace-policy.json")
  );
  for (const file of ["server.ts", "client.tsx", "package.json"])
    cpSync(
      join(repo, "packages/registry", file),
      join(root, "packages/registry", file)
    );
  cpSync(join(repo, "packages/system"), join(root, "packages/system"), {
    recursive: true,
    filter: (path) =>
      !["node_modules", ".turbo", "dist"].includes(basename(path)),
  });
  mkdirSync(join(root, "tooling/eslint-config"), { recursive: true });
  writeFileSync(join(root, "tooling/eslint-config/package.json"), "{}\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("toNames derives every case from a kebab-case name", () => {
  expect(toNames("job-search")).toEqual({
    kebab: "job-search",
    camel: "jobSearch",
    pascal: "JobSearch",
    upper: "JOB_SEARCH",
  });
});

test("renameFeature replaces every form of the reference name", () => {
  const names = toNames("job-search");
  expect(renameFeature("createSystemRoutes", names)).toBe(
    "createJobSearchRoutes"
  );
  expect(renameFeature('"system"', names)).toBe('"job-search"');
  expect(renameFeature("systemPaths", names)).toBe("jobSearchPaths");
  expect(renameFeature("SYSTEM_X", names)).toBe("JOB_SEARCH_X");
});

test("insertAboveMarker inserts the line once, above the marker", () => {
  const source = readFileSync(
    join(root, "packages/registry/server.ts"),
    "utf8"
  );
  const line = 'import { aFeature } from "@jobyssey/a/server";';
  const result = insertAboveMarker(source, "// gen:imports", line);
  const lines = result.split("\n");
  expect(lines.filter((current) => current === line)).toHaveLength(1);
  expect(lines[lines.indexOf(line) + 1]).toBe("// gen:imports");
  expect(() =>
    insertAboveMarker("export const a = 1;\n", "// gen:imports", line)
  ).toThrow('no "// gen:imports" line');
});

test("validateFeatureName rejects bad, reserved and taken names", () => {
  expect(validateFeatureName(root, "JobSearch")).toBe(
    "Feature names are kebab-case: lower-case letters, digits and single dashes"
  );
  for (const name of ["db", "repo", "system"])
    expect(validateFeatureName(root, name)).toBe(
      `"${name}" is reserved (fixed commit scope, platform package or the reference feature)`
    );
  mkdirSync(join(root, "packages/notes"));
  expect(validateFeatureName(root, "notes")).toBe(
    "packages/notes already exists"
  );
  expect(validateFeatureName(root, "eslint-config")).toBe(
    '"eslint-config" is already a workspace folder (tooling/eslint-config); folder names are unique across apps/, packages/ and tooling/ because they are package names and commit scopes'
  );
  expect(validateFeatureName(root, "job-search")).toBeUndefined();
});

test(
  "generateFeature copies, renames and registers the feature",
  () => {
    for (const folder of ["node_modules", ".turbo", "dist"]) {
      mkdirSync(join(root, "packages/system", folder));
      writeFileSync(
        join(root, "packages/system", folder, "seed.txt"),
        "seed\n"
      );
    }
    expect(generateFeature(root, "zz-probe", { install: false })).toEqual([
      "packages/zz-probe/",
      "packages/registry/server.ts",
      "packages/registry/client.tsx",
      "packages/registry/package.json",
    ]);
    const files = globSync("**/*", { cwd: join(root, "packages/zz-probe") });
    expect(files).toContain("tests/zz-probe.test.ts");
    for (const file of files) {
      expect(file).not.toMatch(/system/i);
      const path = join(root, "packages/zz-probe", file);
      if (/\.(ts|tsx|json|md)$/.test(file))
        expect(readFileSync(path, "utf8")).not.toMatch(/system/i);
    }
    const server = readFileSync(
      join(root, "packages/registry/server.ts"),
      "utf8"
    );
    expect(server).toContain(
      'import { zzProbeFeature } from "@jobyssey/zz-probe/server";\n// gen:imports'
    );
    expect(server).toContain("    zzProbeFeature(deps),\n    // gen:entries");
    const client = readFileSync(
      join(root, "packages/registry/client.tsx"),
      "utf8"
    );
    expect(client).toContain(
      'import { zzProbeWebFeature } from "@jobyssey/zz-probe/client";\n// gen:imports'
    );
    expect(client).toContain("  zzProbeWebFeature,\n  // gen:entries");
    const manifest = JSON.parse(
      readFileSync(join(root, "packages/registry/package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@jobyssey/zz-probe"]).toBe("workspace:*");
    for (const folder of ["node_modules", ".turbo", "dist"])
      expect(existsSync(join(root, "packages/zz-probe", folder))).toBe(false);

    // aa-probe sorts before every existing key, so an unsorted insert shows.
    generateFeature(root, "aa-probe", { install: false });
    const keys = Object.keys(
      (
        JSON.parse(
          readFileSync(join(root, "packages/registry/package.json"), "utf8")
        ) as { dependencies: Record<string, string> }
      ).dependencies
    );
    expect(keys[0]).toBe("@jobyssey/aa-probe");
    expect(keys).toEqual([...keys].sort());
  },
  TIMEOUT
);
