// Checks every workspace package against the documented anatomy (CW01-CW18).
// Package kinds come from workspace-policy.json and the parent folder name,
// never from a package.json field. Run: node scripts/check-workspace.ts
import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { API } from "typescript/sync";
import {
  FIXED_SCOPES,
  listWorkspaceDirs,
  matchWorkspaceFolders,
} from "./lib/workspace.ts";

export type Problem = { path: string; message: string };

export type Policy = {
  platform: readonly string[];
  registries: readonly string[];
  nodeApps: readonly string[];
  webApps: readonly string[];
  subpathExports: readonly string[];
  envReaders: readonly string[];
  sharedTables: readonly string[];
  drizzleConfigs: readonly string[];
};

type Kind = "app" | "tooling" | "registry" | "platform" | "feature";

type Manifest = {
  name?: unknown;
  private?: unknown;
  type?: unknown;
  exports?: unknown;
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};

const POLICY_KEYS = [
  "platform",
  "registries",
  "nodeApps",
  "webApps",
  "subpathExports",
  "envReaders",
  "sharedTables",
  "drizzleConfigs",
] as const;

const ENTRY_FILES: Record<string, string> = {
  ".": "index.ts",
  "./server": "server.ts",
  "./schema": "schema.ts",
  "./client": "client.tsx",
  "./shared": "shared.ts",
};

const SUBPATH_KEYS = [
  "./globals.css",
  "./lib/*",
  "./components/*",
  "./hooks/*",
];

const TSCONFIG_BASES = [
  "@jobyssey/typescript-config/base.json",
  "@jobyssey/typescript-config/web.json",
];

const SCRIPTS = { typecheck: "tsc -p .", lint: "oxlint . --max-warnings 0" };

const LEFTOVERS = new Set(["node_modules", ".turbo", "dist", ".gitkeep"]);
const SKIP_DIRS = new Set(["node_modules", ".turbo", "dist"]);

const ENV_PATTERNS = [
  /\bprocess\s*\.\s*env\b/,
  /process\s*\[\s*["'`]env/,
  /\{[^}]*\benv\b[^}]*\}\s*=\s*process\b/,
  /from\s*["'](node:)?process["']/,
];

export function readPolicy(root: string): Policy {
  const file = join(root, "workspace-policy.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: cannot read the workspace policy`, {
      cause: error,
    });
  }
  const policy = raw as Record<string, unknown>;
  for (const key of POLICY_KEYS) {
    const value = policy[key];
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === "string")
    )
      throw new Error(`${file}: "${key}" must be an array of strings`);
  }
  return policy as Policy;
}

function kindOf(dir: string, policy: Policy): Kind {
  const parent = basename(dirname(dir));
  if (parent === "apps") return "app";
  if (parent === "tooling") return "tooling";
  if (policy.registries.includes(dir)) return "registry";
  if (policy.platform.includes(basename(dir))) return "platform";
  // Strict by default: any other package (including unknown parents) is a feature.
  return "feature";
}

// Package-relative file paths, skipping node_modules/.turbo/dist and never following symlinks.
function walk(base: string, rel = ""): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(base, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(base, path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

// Blanks // and /* */ comments, keeping strings and line numbers.
// shortcut: regex literals and `${}` nesting are not parsed, so a `//` inside them hides the rest of that line; switch to the TypeScript scanner if that ever bites.
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      i = end === -1 ? source.length : end;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== char) {
        if (source[j] === "\\") j++;
        j++;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function isTestFile(file: string): boolean {
  return (
    file.startsWith("tests/") ||
    file.includes("/tests/") ||
    /\.test\.tsx?$/.test(file)
  );
}

function importsSpecifier(file: string, specifier: string): boolean {
  if (!existsSync(file)) return false;
  const code = stripComments(readFileSync(file, "utf8"));
  const quoted = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(?:from|import)\\s*\\(?\\s*["']${quoted}["']`).test(code);
}

export async function checkWorkspace(
  root: string,
  policy = readPolicy(root)
): Promise<Problem[]> {
  // TypeScript 7's API runs the compiler in a child process: one per run, closed on every path.
  const api = new API({ cwd: root });
  try {
    return await checkPackages(root, policy, api);
  } finally {
    api.close();
  }
}

async function checkPackages(
  root: string,
  policy: Policy,
  api: API
): Promise<Problem[]> {
  const problems: Problem[] = [];
  const add = (path: string, message: string) =>
    problems.push({ path, message });
  const dirs = listWorkspaceDirs(root);
  const sourceFiles = new Map<string, string[]>();

  // CW01 every folder a workspace glob matches has a package.json.
  // False positive: after a branch switch a folder can keep only build or install leftovers; those are skipped.
  for (const dir of matchWorkspaceFolders(root)) {
    if (dirs.includes(dir)) continue;
    const entries = readdirSync(join(root, dir));
    if (entries.every((entry) => LEFTOVERS.has(entry))) continue;
    add(
      dir,
      "folder matches a pnpm-workspace.yaml glob but has no package.json"
    );
  }

  for (const dir of dirs) {
    const abs = join(root, dir);
    const folder = basename(dir);
    const kind = kindOf(dir, policy);
    const manifestPath = `${dir}/package.json`;
    let pkg: Manifest;
    try {
      pkg = JSON.parse(
        readFileSync(join(abs, "package.json"), "utf8")
      ) as Manifest;
    } catch (error) {
      add(manifestPath, `is not valid JSON (${(error as Error).message})`);
      continue;
    }
    const files = walk(abs);
    sourceFiles.set(dir, files);
    const has = (file: string) => files.includes(file);

    // CW02 name matches the folder. False positive: none in normal use.
    if (pkg.name !== `@jobyssey/${folder}`)
      add(
        manifestPath,
        `"name" is ${JSON.stringify(pkg.name) ?? "missing"}, expected "@jobyssey/${folder}"`
      );

    // CW03 private. False positive: a package that must be published (a future CLI) would need a policy entry.
    if (pkg.private !== true)
      add(
        manifestPath,
        `"private" must be true (workspace packages are never published)`
      );

    // CW04 ESM. False positive: none known.
    if (pkg.type !== "module")
      add(
        manifestPath,
        `"type" must be "module" (Node runs these .ts files as ESM)`
      );

    // CW08 specifiers (peerDependencies are not checked).
    // False positive: `shadcn add` writes literal ranges into packages/ui; move them to the catalog.
    for (const field of ["dependencies", "devDependencies"] as const) {
      for (const [dep, spec] of Object.entries(pkg[field] ?? {})) {
        const internal = dep.startsWith("@jobyssey/");
        const expected = internal ? "workspace:*" : "catalog:";
        if (spec === expected) continue;
        add(
          manifestPath,
          internal
            ? `${field}.${dep} is "${String(spec)}"; workspace packages use "workspace:*"`
            : `${field}.${dep} is "${String(spec)}"; external packages use "catalog:" (versions live in the catalog of pnpm-workspace.yaml)`
        );
      }
    }

    // CW14 folder name. False positive: none.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(folder))
      add(dir, "folder names are kebab-case");
    if ((FIXED_SCOPES as readonly string[]).includes(folder))
      add(
        dir,
        `folder name "${folder}" is also a fixed commit scope; rename it`
      );

    // CW18 README. False positive: none; even config packages explain themselves.
    if (!has("README.md")) add(dir, "every package needs a README.md");

    if (kind === "tooling") continue;
    const subpath = policy.subpathExports.includes(folder);

    // CW05 package exports. False positive: a legitimate new entry point (./testing) fails until the list grows; intended.
    if (kind !== "app") {
      const exportsField: unknown =
        typeof pkg.exports === "string" ? { ".": pkg.exports } : pkg.exports;
      const exportsMap =
        exportsField !== null && typeof exportsField === "object"
          ? (exportsField as Record<string, unknown>)
          : {};
      if (exportsField !== undefined && exportsMap !== exportsField)
        add(manifestPath, `"exports" must map entry keys to files`);
      if (subpath) {
        const keys = Object.keys(exportsMap);
        if (keys.join(" ") !== SUBPATH_KEYS.join(" "))
          add(
            manifestPath,
            `exports keys must be exactly ${SUBPATH_KEYS.map((k) => `"${k}"`).join(", ")}, got ${JSON.stringify(keys)}`
          );
      } else {
        for (const [key, value] of Object.entries(exportsMap)) {
          const file = ENTRY_FILES[key];
          if (file === undefined) {
            add(
              manifestPath,
              `exports key "${key}" is not allowed; packages export only ".", "./server", "./schema", "./client", "./shared"`
            );
          } else if (value !== `./${file}`) {
            add(
              manifestPath,
              `exports["${key}"] must be "./${file}", got ${JSON.stringify(value)}`
            );
          } else if (!has(file)) {
            add(
              manifestPath,
              `exports["${key}"] points to ${file}, which does not exist`
            );
          }
        }
        for (const [key, file] of Object.entries(ENTRY_FILES))
          if (has(file) && !(key in exportsMap))
            add(
              `${dir}/${file}`,
              `exists but package.json exports has no "${key}" entry`
            );
      }
    }

    // CW06 apps have no exports. False positive: none once host code lives in packages.
    if (kind === "app" && pkg.exports !== undefined)
      add(
        manifestPath,
        `apps are assemblies and are never imported; remove "exports"`
      );

    // CW07 scripts. False positive: a package with a special build step needs its own script next to these.
    const scripts = pkg.scripts ?? {};
    const hasTests = files.some((file) => file.startsWith("tests/"));
    const expectedScripts: Record<string, string> = { ...SCRIPTS };
    if (hasTests) expectedScripts.test = "vitest run";
    for (const [name, expected] of Object.entries(expectedScripts))
      if (scripts[name] !== expected)
        add(
          manifestPath,
          `scripts.${name} must be "${expected}", got ${JSON.stringify(scripts[name]) ?? "missing"}`
        );
    if (!hasTests && scripts.test !== undefined)
      add(
        manifestPath,
        `scripts.test is set but there is no tests/ folder; vitest would fail with no test files`
      );

    // CW09 tsconfig. False positive: a package that truly needs another lib (a web worker).
    if (!has("tsconfig.json")) {
      add(dir, "missing tsconfig.json");
    } else {
      const tsconfigPath = `${dir}/tsconfig.json`;
      // readConfigFile returns the file's own JSON (comments allowed), not the merged config.
      const { error, ...parsed } = api.readConfigFile(
        join(abs, "tsconfig.json")
      );
      const config = parsed.config as Record<string, unknown> | undefined;
      if (error || config === undefined) {
        add(tsconfigPath, `cannot be parsed: ${error?.text ?? "empty"}`);
      } else {
        if (!TSCONFIG_BASES.includes(config.extends as string))
          add(
            tsconfigPath,
            `"extends" must be "${TSCONFIG_BASES[0]}" or "${TSCONFIG_BASES[1]}", got ${JSON.stringify(config.extends) ?? "missing"}`
          );
        const options = (config.compilerOptions ?? {}) as Record<
          string,
          unknown
        >;
        for (const key of Object.keys(options))
          if (key !== "types")
            add(
              tsconfigPath,
              `compilerOptions.${key} overrides the base config; only "types" may be set here`
            );
      }
    }

    // CW10 layout. False positive: ui keeps shadcn's src/ (exempt through subpathExports).
    const hasSrc = files.some((file) => file.startsWith("src/"));
    if (kind === "app" && !hasSrc) add(dir, "apps keep their code in src/");
    if (kind !== "app" && hasSrc && !subpath)
      add(
        `${dir}/src`,
        "packages keep entry files at the root and code in lib/; move src/ to lib/"
      );

    // CW11 entry files per kind. False positive: every new platform package fails until listed in workspace-policy.json; intended.
    const entries = Object.values(ENTRY_FILES).filter(has);
    if (kind === "feature") {
      if (!has("index.ts")) add(dir, "feature packages need index.ts");
      if (!has("server.ts") && !has("client.tsx"))
        add(
          dir,
          `a feature needs server.ts or client.tsx; if this is a platform package, add it to "platform" in workspace-policy.json`
        );
    }
    if (
      (kind === "platform" || kind === "registry") &&
      !subpath &&
      entries.length === 0
    )
      add(
        dir,
        "a platform package needs at least one root entry file (index.ts, server.ts, schema.ts, client.tsx, shared.ts)"
      );

    // CW12 features have tests. False positive: none for features; platform packages are exempt.
    if (
      kind === "feature" &&
      !files.some((file) => /^tests\/.*\.test\.tsx?$/.test(file))
    )
      add(dir, "feature packages need at least one tests/**/*.test.ts(x)");

    // CW13 registration (skipped while no registry exists).
    // False positive: a feature meant only for another workspace's registry needs that registry listed in its policy.
    const registries = policy.registries.filter((reg) =>
      existsSync(join(root, reg))
    );
    if (kind === "feature" && registries.length > 0) {
      for (const [file, sub] of [
        ["server.ts", "server"],
        ["client.tsx", "client"],
      ] as const) {
        if (!has(file)) continue;
        const specifier = `@jobyssey/${folder}/${sub}`;
        if (
          !registries.some((reg) =>
            importsSpecifier(join(root, reg, file), specifier)
          )
        )
          add(
            `${dir}/${file}`,
            `is not registered: no registry ${file} imports "${specifier}" (registries: ${registries.join(", ")})`
          );
      }
    }

    // CW17 process.env readers. Exempt: policy.envReaders, files inside a tests/ folder (not *.test.ts elsewhere), *.config.{ts,js}; tooling is skipped above, scripts/ is not a workspace.
    // Keep in step with the oxlint no-restricted-properties exemptions in oxlint.config.ts (`**/tests/**/*.{ts,tsx}`).
    // False positive: a string literal such as "set process.env.X" in an error text, or a colocated lib/*.test.ts that reads the environment (move it to tests/); reword or move it.
    for (const file of files) {
      if (
        !/\.tsx?$/.test(file) ||
        file.startsWith("tests/") ||
        file.includes("/tests/") ||
        /\.config\.(ts|js)$/.test(file)
      )
        continue;
      const path = `${dir}/${file}`;
      if (policy.envReaders.includes(path)) continue;
      const code = stripComments(readFileSync(join(abs, file), "utf8"));
      const lines = new Set<number>();
      for (const pattern of ENV_PATTERNS) {
        const match = new RegExp(pattern.source, "g");
        for (const hit of code.matchAll(match))
          lines.add(lineOf(code, hit.index));
      }
      for (const line of [...lines].sort((a, b) => a - b))
        add(
          `${path}:${line}`,
          `reads process.env; only ${policy.envReaders.join(" and ")} read the environment. Take the value as a parameter (it comes from loadConfig).`
        );
    }
  }

  // CW15 schema coverage (skipped while none of the drizzle configs exists).
  // False positive: `pgTable(` inside a comment, so comments are stripped first.
  const configs = policy.drizzleConfigs.filter((config) =>
    existsSync(join(root, config))
  );
  if (configs.length > 0) {
    const covered = new Set<string>();
    for (const config of configs) {
      const configAbs = join(root, config);
      try {
        const mod = (await import(pathToFileURL(configAbs).href)) as {
          default?: { schema?: string | string[] };
        };
        const globs = mod.default?.schema ?? [];
        const cwd = dirname(configAbs);
        for (const match of globSync(globs, { cwd }))
          covered.add(relative(root, resolve(cwd, match)));
      } catch (error) {
        add(config, `cannot be imported: ${(error as Error).message}`);
      }
    }
    for (const [dir, files] of sourceFiles) {
      if (kindOf(dir, policy) === "tooling") continue;
      if (files.includes("schema.ts") && !covered.has(`${dir}/schema.ts`))
        add(
          `${dir}/schema.ts`,
          `is not matched by the "schema" globs in ${configs.join(", ")}; drizzle-kit would never generate its tables`
        );
      for (const file of files) {
        if (file === "schema.ts" || !/\.tsx?$/.test(file) || isTestFile(file))
          continue;
        const code = stripComments(readFileSync(join(root, dir, file), "utf8"));
        for (const hit of code.matchAll(/\bpgTable\s*\(/g))
          add(
            `${dir}/${file}:${lineOf(code, hit.index)}`,
            "defines a table outside schema.ts; tables live only in the package's root schema.ts"
          );
      }
    }
  }

  // CW16 account scope. False positive: a table linking two accounts (owner_account_id) must be renamed or marked shared.
  // Keep the runtime findUnscopedTables test too: it also sees tables created by hand-written SQL migrations.
  for (const [dir, files] of sourceFiles) {
    if (kindOf(dir, policy) === "tooling" || !files.includes("schema.ts"))
      continue;
    const path = `${dir}/schema.ts`;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(join(root, path)).href)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      add(path, `cannot be imported: ${(error as Error).message}`);
      continue;
    }
    for (const value of Object.values(mod)) {
      if (!is(value, PgTable)) continue;
      const table = getTableConfig(value);
      if (policy.sharedTables.includes(table.name)) continue;
      const column = table.columns.find((col) => col.name === "account_id");
      if (column === undefined) {
        add(
          path,
          `table "${table.name}" has no account_id column; per-account tables need account_id NOT NULL REFERENCES accounts(id), or list the table in SHARED_TABLES (packages/db) and "sharedTables" in workspace-policy.json`
        );
        continue;
      }
      if (!column.notNull)
        add(path, `table "${table.name}": account_id must be NOT NULL`);
      const linked = table.foreignKeys.some((fk) => {
        const ref = fk.reference();
        return (
          ref.columns.length === 1 &&
          ref.columns[0]?.name === "account_id" &&
          getTableConfig(ref.foreignTable).name === "accounts" &&
          ref.foreignColumns[0]?.name === "id"
        );
      });
      if (!linked)
        add(
          path,
          `table "${table.name}": account_id needs a foreign key to accounts(id)`
        );
    }
  }

  return problems.sort((a, b) =>
    `${a.path}: ${a.message}`.localeCompare(`${b.path}: ${b.message}`)
  );
}

if (import.meta.main) {
  const root = join(import.meta.dirname, "..");
  try {
    const problems = await checkWorkspace(root);
    for (const { path, message } of problems)
      console.error(`${path}: ${message}`);
    if (problems.length > 0) {
      console.error(`check-workspace: ${problems.length} problem(s)`);
      process.exitCode = 1;
    } else {
      console.log("check-workspace: no problems");
    }
  } catch (error) {
    console.error(`check-workspace: ${(error as Error).message}`);
    process.exitCode = 2;
  }
}
