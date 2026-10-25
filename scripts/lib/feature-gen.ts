// Generates a feature package from the reference feature (packages/system):
// copy, rename every identifier, register it in packages/registry, install.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { FIXED_SCOPES, listWorkspaceDirs } from "./workspace.ts";

export type FeatureNames = {
  kebab: string;
  camel: string;
  pascal: string;
  upper: string;
};

const REFERENCE = "system";
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".json", ".md"]);
const SKIP = new Set(["node_modules", ".turbo", "dist"]);
const IMPORTS_MARKER = "// gen:imports";
const ENTRIES_MARKER = "// gen:entries";
const INSTALL_TIMEOUT_MS = 10 * 60_000;

export function toNames(name: string): FeatureNames {
  const words = name.split("-");
  const pascal = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return {
    kebab: name,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
    pascal,
    upper: words.join("_").toUpperCase(),
  };
}

export function validateFeatureName(
  root: string,
  name: string
): string | undefined {
  // A leading digit would make the camel-case identifiers invalid.
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name))
    return "Feature names are kebab-case: lower-case letters, digits and single dashes";
  const policy = JSON.parse(
    readFileSync(join(root, "workspace-policy.json"), "utf8")
  ) as { platform: string[]; registries: string[] };
  const reserved = [
    ...FIXED_SCOPES,
    ...policy.platform,
    ...policy.registries.map((path) => basename(path)),
    REFERENCE,
  ];
  if (reserved.includes(name))
    return `"${name}" is reserved (fixed commit scope, platform package or the reference feature)`;
  if (existsSync(join(root, "packages", name)))
    return `packages/${name} already exists`;
  const taken = listWorkspaceDirs(root).find(
    (folder) => basename(folder) === name
  );
  if (taken !== undefined)
    return `"${name}" is already a workspace folder (${taken}); folder names are unique across apps/, packages/ and tooling/ because they are package names and commit scopes`;
  return undefined;
}

export function renameFeature(source: string, names: FeatureNames): string {
  return source
    .replace(/\bsystem(?=[A-Z])/g, names.camel)
    .replace(/System/g, names.pascal)
    .replace(/\bSYSTEM(?=_)/g, names.upper)
    .replace(/\bsystem\b/g, names.kebab);
}

export function insertAboveMarker(
  source: string,
  marker: string,
  line: string
): string {
  const lines = source.split("\n");
  const index = lines.findIndex((current) => current.trim() === marker);
  if (index === -1) throw new Error(`no "${marker}" line`);
  lines.splice(index, 0, line);
  return lines.join("\n");
}

type Entry = { path: string; isDir: boolean };

function walk(dir: string): Entry[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? [...walk(path), { path, isDir: true }]
      : [{ path, isDir: false }];
  });
}

const isText = (entry: Entry) =>
  !entry.isDir && TEXT_EXTENSIONS.has(extname(entry.path));

// Renames the copy's file contents and names; children before their folders.
function renameTree(dir: string, names: FeatureNames): void {
  for (const entry of walk(dir)) {
    if (isText(entry))
      writeFileSync(
        entry.path,
        renameFeature(readFileSync(entry.path, "utf8"), names)
      );
    const name = basename(entry.path);
    if (name.includes(REFERENCE))
      renameSync(
        entry.path,
        join(dirname(entry.path), renameFeature(name, names))
      );
  }
}

function findReference(dir: string, root: string): string | undefined {
  for (const entry of walk(dir).filter(isText)) {
    const lines = readFileSync(entry.path, "utf8").split("\n");
    const index = lines.findIndex((line) => /\bsystem\b/i.test(line));
    if (index !== -1) return `${relative(root, entry.path)}:${index + 1}`;
  }
  return undefined;
}

export function generateFeature(
  root: string,
  name: string,
  options: { install?: boolean } = {}
): string[] {
  const problem = validateFeatureName(root, name);
  if (problem !== undefined) throw new Error(problem);
  const names = toNames(name);
  const registry = join(root, "packages/registry");

  // Every registry edit is computed first, so a missing marker writes nothing.
  const edits: [string, string][] = [];
  for (const [file, imports, entry] of [
    [
      "server.ts",
      `import { ${names.camel}Feature } from "@jobyssey/${names.kebab}/server";`,
      `    ${names.camel}Feature(deps),`,
    ],
    [
      "client.tsx",
      `import { ${names.camel}WebFeature } from "@jobyssey/${names.kebab}/client";`,
      `  ${names.camel}WebFeature,`,
    ],
  ] as const) {
    const path = join(registry, file);
    const source = readFileSync(path, "utf8");
    try {
      edits.push([
        path,
        insertAboveMarker(
          insertAboveMarker(source, IMPORTS_MARKER, imports),
          ENTRIES_MARKER,
          entry
        ),
      ]);
    } catch (error) {
      throw new Error(
        `packages/registry/${file} has ${(error as Error).message}; restore it before generating`,
        { cause: error }
      );
    }
  }
  const manifestPath = join(registry, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  manifest.dependencies = Object.fromEntries(
    Object.entries({
      ...manifest.dependencies,
      [`@jobyssey/${names.kebab}`]: "workspace:*",
    }).sort(([a], [b]) => a.localeCompare(b))
  );

  const target = join(root, "packages", names.kebab);
  cpSync(join(root, "packages", REFERENCE), target, {
    recursive: true,
    filter: (path) => !SKIP.has(basename(path)),
  });
  try {
    renameTree(target, names);
    const left = findReference(target, root);
    if (left !== undefined)
      throw new Error(
        `Reference name "${REFERENCE}" still appears in ${left}; extend renameFeature`
      );
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }

  for (const [path, content] of edits) writeFileSync(path, content);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const changed = [
    `packages/${names.kebab}/`,
    "packages/registry/server.ts",
    "packages/registry/client.tsx",
    "packages/registry/package.json",
  ];
  if (options.install !== false) {
    // pnpm turns frozenLockfile on whenever CI is set; the new link needs a lockfile change.
    execFileSync(
      "pnpm",
      ["install", "--prefer-offline", "--no-frozen-lockfile"],
      {
        cwd: root,
        stdio: "inherit",
        timeout: INSTALL_TIMEOUT_MS,
      }
    );
    changed.push("pnpm-lock.yaml");
  }
  return changed;
}
