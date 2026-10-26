import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SHARED_TABLES } from "@jobyssey/db";
import { afterEach, expect, test } from "vitest";
import { checkWorkspace, readPolicy, type Problem } from "./check-workspace.ts";

const repo = join(import.meta.dirname, "..");
// Real file I/O plus dynamic schema imports; generous so a loaded machine cannot fail it.
const TIMEOUT = 30_000;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function put(root: string, file: string, content: unknown): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(
    join(root, file),
    typeof content === "string"
      ? content
      : `${JSON.stringify(content, null, 2)}\n`
  );
}

function editJson(
  root: string,
  file: string,
  edit: (json: Record<string, unknown>) => void
): void {
  const json = JSON.parse(readFileSync(join(root, file), "utf8")) as Record<
    string,
    unknown
  >;
  edit(json);
  put(root, file, json);
}

const scripts = { typecheck: "tsc -p .", lint: "eslint . --max-warnings 0" };
const tsconfig = `{
  // comments are allowed: CW09 parses with typescript's readConfigFile
  "extends": "@jobyssey/typescript-config/base.json",
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": { "types": ["node"] }
}
`;

function package_(
  name: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    name: `@jobyssey/${name}`,
    private: true,
    type: "module",
    ...extra,
  };
}

function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "jby-check-workspace-"));
  roots.push(root);
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"), "dir");
  put(
    root,
    "pnpm-workspace.yaml",
    "packages:\n  - apps/*\n  - packages/*\n  - tooling/*\n"
  );
  put(
    root,
    "workspace-policy.json",
    readFileSync(join(repo, "workspace-policy.json"), "utf8")
  );

  put(
    root,
    "packages/alpha/package.json",
    package_("alpha", {
      exports: {
        ".": "./index.ts",
        "./server": "./server.ts",
        "./schema": "./schema.ts",
        "./client": "./client.tsx",
        "./shared": "./shared.ts",
      },
      scripts: { ...scripts, test: "vitest run" },
      devDependencies: {
        "@jobyssey/typescript-config": "workspace:*",
        vitest: "catalog:",
      },
    })
  );
  put(root, "packages/alpha/tsconfig.json", tsconfig);
  put(root, "packages/alpha/README.md", "# alpha\n");
  put(root, "packages/alpha/index.ts", 'export const name = "alpha";\n');
  put(
    root,
    "packages/alpha/server.ts",
    "export const alphaServer = () => 1;\n"
  );
  put(
    root,
    "packages/alpha/schema.ts",
    [
      'import { integer, pgTable, serial } from "drizzle-orm/pg-core";',
      'import { accounts } from "../db/schema.ts";',
      'export const notes = pgTable("alpha_notes", {',
      "  id: serial().primaryKey(),",
      '  account_id: integer("account_id").notNull().references(() => accounts.id),',
      "});",
      "",
    ].join("\n")
  );
  put(
    root,
    "packages/alpha/client.tsx",
    "export const AlphaPage = () => null;\n"
  );
  put(root, "packages/alpha/shared.ts", "export type AlphaStatus = string;\n");
  put(root, "packages/alpha/lib/format.ts", "export const format = String;\n");
  put(
    root,
    "packages/alpha/tests/alpha.test.ts",
    'import { test } from "vitest";\ntest("x", () => {});\n'
  );

  put(
    root,
    "packages/db/package.json",
    package_("db", {
      exports: { ".": "./index.ts", "./schema": "./schema.ts" },
      scripts,
      devDependencies: { "@jobyssey/typescript-config": "workspace:*" },
    })
  );
  put(root, "packages/db/tsconfig.json", tsconfig);
  put(root, "packages/db/README.md", "# db\n");
  put(root, "packages/db/index.ts", "export const db = 1;\n");
  put(
    root,
    "packages/db/schema.ts",
    'import { pgTable, serial } from "drizzle-orm/pg-core";\nexport const accounts = pgTable("accounts", { id: serial().primaryKey() });\n'
  );
  put(
    root,
    "packages/db/drizzle.config.ts",
    'export default { dialect: "postgresql", schema: ["../*/schema.ts"] };\n'
  );

  put(
    root,
    "packages/registry/package.json",
    package_("registry", {
      exports: { "./server": "./server.ts", "./client": "./client.tsx" },
      scripts,
      dependencies: { "@jobyssey/alpha": "workspace:*" },
      devDependencies: { "@jobyssey/typescript-config": "workspace:*" },
    })
  );
  put(root, "packages/registry/tsconfig.json", tsconfig);
  put(root, "packages/registry/README.md", "# registry\n");
  put(
    root,
    "packages/registry/server.ts",
    'import { alphaServer } from "@jobyssey/alpha/server";\nexport const features = [alphaServer];\n'
  );
  put(
    root,
    "packages/registry/client.tsx",
    'import { AlphaPage } from "@jobyssey/alpha/client";\nexport const pages = [AlphaPage];\n'
  );

  put(
    root,
    "apps/api/package.json",
    package_("api", {
      scripts,
      dependencies: { "@jobyssey/registry": "workspace:*" },
      devDependencies: { "@jobyssey/typescript-config": "workspace:*" },
    })
  );
  put(root, "apps/api/tsconfig.json", tsconfig);
  put(root, "apps/api/README.md", "# api\n");
  put(root, "apps/api/src/main.ts", "export const port = process.env.PORT;\n");

  put(
    root,
    "tooling/typescript-config/package.json",
    package_("typescript-config", { exports: { "./base.json": "./base.json" } })
  );
  put(root, "tooling/typescript-config/README.md", "# typescript-config\n");
  put(root, "tooling/typescript-config/base.json", "{}\n");
  return root;
}

const cases: [id: string, mutate: (root: string) => void, expected: Problem][] =
  [
    [
      "CW01",
      (root) => put(root, "packages/orphan/notes.ts", "export {};\n"),
      {
        path: "packages/orphan",
        message:
          "folder matches a pnpm-workspace.yaml glob but has no package.json",
      },
    ],
    [
      "CW02",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          pkg.name = "@jobyssey/wrong";
        }),
      {
        path: "packages/alpha/package.json",
        message: '"name" is "@jobyssey/wrong", expected "@jobyssey/alpha"',
      },
    ],
    [
      "CW03",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          pkg.private = false;
        }),
      {
        path: "packages/alpha/package.json",
        message:
          '"private" must be true (workspace packages are never published)',
      },
    ],
    [
      "CW04",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          pkg.type = "commonjs";
        }),
      {
        path: "packages/alpha/package.json",
        message: '"type" must be "module" (Node runs these .ts files as ESM)',
      },
    ],
    [
      "CW05",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          (pkg.exports as Record<string, string>)["./utils"] = "./utils.ts";
        }),
      {
        path: "packages/alpha/package.json",
        message:
          'exports key "./utils" is not allowed; packages export only ".", "./server", "./schema", "./client", "./shared"',
      },
    ],
    [
      "CW06",
      (root) =>
        editJson(root, "apps/api/package.json", (pkg) => {
          pkg.exports = { ".": "./src/main.ts" };
        }),
      {
        path: "apps/api/package.json",
        message: 'apps are assemblies and are never imported; remove "exports"',
      },
    ],
    [
      "CW07",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          (pkg.scripts as Record<string, string>).lint = "eslint .";
        }),
      {
        path: "packages/alpha/package.json",
        message:
          'scripts.lint must be "eslint . --max-warnings 0", got "eslint ."',
      },
    ],
    [
      "CW08",
      (root) =>
        editJson(root, "packages/alpha/package.json", (pkg) => {
          (pkg.devDependencies as Record<string, string>).vitest = "^5.0.5";
        }),
      {
        path: "packages/alpha/package.json",
        message:
          'devDependencies.vitest is "^5.0.5"; external packages use "catalog:" (versions live in the catalog of pnpm-workspace.yaml)',
      },
    ],
    [
      "CW09",
      (root) =>
        put(
          root,
          "packages/alpha/tsconfig.json",
          tsconfig.replace('"types"', '"strict": false, "types"')
        ),
      {
        path: "packages/alpha/tsconfig.json",
        message:
          'compilerOptions.strict overrides the base config; only "types" may be set here',
      },
    ],
    [
      "CW10",
      (root) =>
        put(root, "packages/db/src/pool.ts", "export const pool = 1;\n"),
      {
        path: "packages/db/src",
        message:
          "packages keep entry files at the root and code in lib/; move src/ to lib/",
      },
    ],
    [
      "CW11",
      (root) => {
        rmSync(join(root, "packages/alpha/server.ts"));
        rmSync(join(root, "packages/alpha/client.tsx"));
        editJson(root, "packages/alpha/package.json", (pkg) => {
          const exports = pkg.exports as Record<string, string>;
          delete exports["./server"];
          delete exports["./client"];
        });
      },
      {
        path: "packages/alpha",
        message:
          'a feature needs server.ts or client.tsx; if this is a platform package, add it to "platform" in workspace-policy.json',
      },
    ],
    [
      "CW12",
      (root) => {
        rmSync(join(root, "packages/alpha/tests"), { recursive: true });
        editJson(root, "packages/alpha/package.json", (pkg) => {
          delete (pkg.scripts as Record<string, string>).test;
        });
      },
      {
        path: "packages/alpha",
        message: "feature packages need at least one tests/**/*.test.ts(x)",
      },
    ],
    [
      "CW13",
      (root) =>
        put(
          root,
          "packages/registry/server.ts",
          "export const features = [];\n"
        ),
      {
        path: "packages/alpha/server.ts",
        message:
          'is not registered: no registry server.ts imports "@jobyssey/alpha/server" (registries: packages/registry)',
      },
    ],
    [
      "CW14",
      (root) => {
        renameSync(
          join(root, "tooling/typescript-config"),
          join(root, "tooling/TS_Config")
        );
        editJson(root, "tooling/TS_Config/package.json", (pkg) => {
          pkg.name = "@jobyssey/TS_Config";
        });
      },
      { path: "tooling/TS_Config", message: "folder names are kebab-case" },
    ],
    [
      "CW15",
      (root) =>
        put(
          root,
          "packages/db/drizzle.config.ts",
          'export default { dialect: "postgresql", schema: ["./schema.ts"] };\n'
        ),
      {
        path: "packages/alpha/schema.ts",
        message:
          'is not matched by the "schema" globs in packages/db/drizzle.config.ts; drizzle-kit would never generate its tables',
      },
    ],
    [
      "CW16",
      (root) =>
        put(
          root,
          "packages/alpha/schema.ts",
          'import { pgTable, serial } from "drizzle-orm/pg-core";\nexport const notes = pgTable("alpha_notes", { id: serial().primaryKey() });\n'
        ),
      {
        path: "packages/alpha/schema.ts",
        message:
          'table "alpha_notes" has no account_id column; per-account tables need account_id NOT NULL REFERENCES accounts(id), or list the table in SHARED_TABLES (packages/db) and "sharedTables" in workspace-policy.json',
      },
    ],
    [
      "CW16 (nullable account_id)",
      (root) =>
        put(
          root,
          "packages/alpha/schema.ts",
          [
            'import { integer, pgTable, serial } from "drizzle-orm/pg-core";',
            'import { accounts } from "../db/schema.ts";',
            'export const notes = pgTable("alpha_notes", {',
            "  id: serial().primaryKey(),",
            '  account_id: integer("account_id").references(() => accounts.id),',
            "});",
            "",
          ].join("\n")
        ),
      {
        path: "packages/alpha/schema.ts",
        message: 'table "alpha_notes": account_id must be NOT NULL',
      },
    ],
    [
      "CW16 (no foreign key)",
      (root) =>
        put(
          root,
          "packages/alpha/schema.ts",
          [
            'import { integer, pgTable, serial } from "drizzle-orm/pg-core";',
            'export const notes = pgTable("alpha_notes", {',
            "  id: serial().primaryKey(),",
            '  account_id: integer("account_id").notNull(),',
            "});",
            "",
          ].join("\n")
        ),
      {
        path: "packages/alpha/schema.ts",
        message:
          'table "alpha_notes": account_id needs a foreign key to accounts(id)',
      },
    ],
    [
      "CW17",
      (root) =>
        put(
          root,
          "packages/alpha/lib/env.ts",
          "// process.env in a comment is ignored\nexport const level = process.env.LOG_LEVEL;\n"
        ),
      {
        path: "packages/alpha/lib/env.ts:2",
        message:
          "reads process.env; only apps/api/src/main.ts and apps/api/src/dev.ts read the environment. Take the value as a parameter (it comes from loadConfig).",
      },
    ],
    [
      "CW17 (colocated *.test.ts outside tests/)",
      (root) =>
        put(
          root,
          "packages/alpha/lib/x.test.ts",
          "export const level = process.env.LOG_LEVEL;\n"
        ),
      {
        path: "packages/alpha/lib/x.test.ts:1",
        message:
          "reads process.env; only apps/api/src/main.ts and apps/api/src/dev.ts read the environment. Take the value as a parameter (it comes from loadConfig).",
      },
    ],
    [
      "CW18",
      (root) => rmSync(join(root, "packages/alpha/README.md")),
      { path: "packages/alpha", message: "every package needs a README.md" },
    ],
  ];

test(
  "the valid fixture workspace has no problems",
  { timeout: TIMEOUT },
  async () => {
    expect(await checkWorkspace(buildFixture())).toEqual([]);
  }
);

test.for(cases)(
  "%s bites",
  { timeout: TIMEOUT },
  async ([, mutate, expected]) => {
    const root = buildFixture();
    mutate(root);
    expect(await checkWorkspace(root)).toEqual([expected]);
  }
);

test("the real repository has no problems", { timeout: TIMEOUT }, async () => {
  expect(await checkWorkspace(repo)).toEqual([]);
});

test("sharedTables in workspace-policy.json equals SHARED_TABLES", () => {
  expect(readPolicy(repo).sharedTables).toEqual([...SHARED_TABLES]);
});
