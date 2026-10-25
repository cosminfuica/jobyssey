// Adds shadcn components to packages/ui. The shadcn CLI resolves its aliases
// through tsconfig "paths", which this repo bans, so the CLI runs inside a
// scratch project and only the generated files are copied into packages/ui.
// Run: pnpm ui:add <component...>
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { parseDocument, Scalar } from "yaml";

const SHADCN = "shadcn@4.22.1";
const SCRATCH_DEPENDENCIES = ["react", "react-dom"];
const SCRATCH_DEV_DEPENDENCIES = [
  "vite",
  "@vitejs/plugin-react",
  "tailwindcss",
  "@tailwindcss/vite",
  "typescript",
  "@types/react",
  "@types/react-dom",
];
const COMMAND_TIMEOUT_MS = 10 * 60_000;

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

// Files under the scratch src/ that belong in packages/ui/src/.
export function copyList(scratchSrc: string): string[] {
  const list: string[] = [];
  for (const [dir, extension] of [
    ["components", ".tsx"],
    ["hooks", ".ts"],
    ["lib", ".ts"],
  ] as const) {
    const abs = join(scratchSrc, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true }))
      if (entry.isFile() && entry.name.endsWith(extension))
        list.push(`${dir}/${entry.name}`);
  }
  return list.sort();
}

// The scratch components.json, with components living flat in src/components/.
export function rewriteAliases(componentsJson: string): string {
  const config = JSON.parse(componentsJson) as {
    aliases?: Record<string, string>;
  };
  if (config.aliases === undefined)
    throw new Error("components.json has no aliases");
  config.aliases.ui = "@jobyssey/ui/components";
  return `${JSON.stringify(config, null, 2)}\n`;
}

function packageName(specifier: string): string | undefined {
  if (/^(\.|\/|node:|@jobyssey\/)/.test(specifier)) return undefined;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

// Packages a file needs at runtime: imports, side-effect imports and
// re-exports of bare specifiers; `import type`/`export type` are erased.
export function importedPackages(file: string, content: string): string[] {
  const specifiers: string[] = [];
  if (file.endsWith(".css")) {
    for (const match of content.matchAll(/^\s*@import\s+["']([^"']+)["']/gm))
      if (match[1] !== undefined) specifiers.push(match[1]);
  } else {
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      false,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    for (const statement of source.statements) {
      const runtime =
        (ts.isImportDeclaration(statement) &&
          statement.importClause?.isTypeOnly !== true) ||
        (ts.isExportDeclaration(statement) && !statement.isTypeOnly);
      const specifier = (statement as { moduleSpecifier?: ts.Expression })
        .moduleSpecifier;
      if (runtime && specifier !== undefined && ts.isStringLiteral(specifier))
        specifiers.push(specifier.text);
    }
  }
  const names = specifiers.map(packageName);
  return [...new Set(names.filter((name) => name !== undefined))].sort();
}

// Catalog entries to add (with the range the CLI chose) and the new
// packages/ui dependencies: every imported package becomes "catalog:".
export function mergeDependencies(input: {
  catalog: Readonly<Record<string, string>>;
  chosen: Readonly<Record<string, string>>;
  imported: readonly string[];
  current: Readonly<Record<string, string>>;
}): {
  catalogAdditions: Record<string, string>;
  dependencies: Record<string, string>;
} {
  const catalogAdditions: Record<string, string> = {};
  const dependencies: Record<string, string> = { ...input.current };
  for (const name of input.imported) {
    if (!(name in input.catalog)) {
      const range = input.chosen[name];
      if (range === undefined)
        throw new Error(
          `${name} is imported, but neither the catalog nor the scratch package.json has a version for it`
        );
      catalogAdditions[name] = range;
    }
    dependencies[name] = "catalog:";
  }
  return {
    catalogAdditions,
    dependencies: Object.fromEntries(
      Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
    ),
  };
}

function run(cwd: string, args: string[]): void {
  console.log(`$ pnpm ${args.join(" ")}  (in ${cwd})`);
  execFileSync("pnpm", args, {
    cwd,
    stdio: "inherit",
    timeout: COMMAND_TIMEOUT_MS,
  });
}

function versions(
  catalog: Readonly<Record<string, string>>,
  names: readonly string[]
): Record<string, string> {
  return Object.fromEntries(
    names.map((name) => {
      const range = catalog[name];
      if (range === undefined)
        throw new Error(`${name} is missing from the catalog`);
      return [name, range];
    })
  );
}

function writeScratch(scratch: string, catalog: Record<string, string>): void {
  const put = (file: string, content: string) => {
    mkdirSync(dirname(join(scratch, file)), { recursive: true });
    writeFileSync(join(scratch, file), content);
  };
  put(
    "package.json",
    `${JSON.stringify(
      {
        name: "shadcn-scratch",
        private: true,
        type: "module",
        dependencies: versions(catalog, SCRATCH_DEPENDENCIES),
        devDependencies: versions(catalog, SCRATCH_DEV_DEPENDENCIES),
      },
      null,
      2
    )}\n`
  );
  put(
    "tsconfig.json",
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "bundler",
          paths: { "@jobyssey/ui/*": ["./src/*"] },
        },
        include: ["src"],
      },
      null,
      2
    )}\n`
  );
  put(
    "vite.config.ts",
    'import tailwindcss from "@tailwindcss/vite";\nimport react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n'
  );
  put(
    "index.html",
    '<!doctype html>\n<html lang="en">\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n'
  );
  put("src/main.tsx", 'import "./styles/globals.css";\n');
  put("src/styles/globals.css", '@import "tailwindcss";\n');
}

function main(components: string[]): void {
  if (components.length === 0) {
    console.error("usage: pnpm ui:add <component...>");
    process.exitCode = 1;
    return;
  }
  const root = join(import.meta.dirname, "..");
  const ui = join(root, "packages/ui");
  const workspaceFile = join(root, "pnpm-workspace.yaml");
  const workspace = parseDocument(readFileSync(workspaceFile, "utf8"));
  const catalog = (workspace.toJS() as { catalog?: Record<string, string> })
    .catalog;
  if (catalog === undefined)
    throw new Error("pnpm-workspace.yaml has no catalog");

  const scratch = mkdtempSync(join(tmpdir(), "jby-shadcn-"));
  let keepScratch = false;
  try {
    writeScratch(scratch, catalog);
    run(scratch, ["install"]);
    run(scratch, [
      "dlx",
      SHADCN,
      "init",
      "--yes",
      "--template",
      "vite",
      "--base",
      "radix",
      "--preset",
      "nova",
      "--no-monorepo",
    ]);
    const componentsJson = join(scratch, "components.json");
    writeFileSync(
      componentsJson,
      rewriteAliases(readFileSync(componentsJson, "utf8"))
    );
    const nested = join(scratch, "src/components/ui");
    if (existsSync(nested)) {
      for (const entry of readdirSync(nested))
        renameSync(join(nested, entry), join(scratch, "src/components", entry));
      rmSync(nested, { recursive: true });
    }
    run(scratch, ["dlx", SHADCN, "add", ...components, "--yes", "--overwrite"]);

    const copied: string[] = [];
    for (const file of copyList(join(scratch, "src"))) {
      const target = join(ui, "src", file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(scratch, "src", file), target);
      copied.push(`packages/ui/src/${file}`);
    }
    const scratchCss = join(scratch, "src/styles/globals.css");
    const css = join(ui, "src/styles/globals.css");
    if (
      !existsSync(css) ||
      !readFileSync(css, "utf8").includes("@theme inline")
    ) {
      mkdirSync(dirname(css), { recursive: true });
      copyFileSync(scratchCss, css);
      copied.push("packages/ui/src/styles/globals.css");
    } else if (readFileSync(css, "utf8") !== readFileSync(scratchCss, "utf8")) {
      keepScratch = true;
      console.log(`styles differ; review ${scratchCss}`);
    }

    const imported = [
      ...copyList(join(ui, "src")).map((file) =>
        importedPackages(file, readFileSync(join(ui, "src", file), "utf8"))
      ),
      importedPackages(css, readFileSync(css, "utf8")),
    ].flat();
    const scratchManifest = JSON.parse(
      readFileSync(join(scratch, "package.json"), "utf8")
    ) as Manifest;
    const uiManifestFile = join(ui, "package.json");
    const uiManifest = JSON.parse(
      readFileSync(uiManifestFile, "utf8")
    ) as Manifest;
    const merged = mergeDependencies({
      catalog,
      chosen: {
        ...scratchManifest.devDependencies,
        ...scratchManifest.dependencies,
      },
      imported: [...new Set(imported)].sort(),
      current: uiManifest.dependencies ?? {},
    });
    for (const [name, range] of Object.entries(merged.catalogAdditions)) {
      const value = new Scalar(range);
      value.type = Scalar.QUOTE_DOUBLE;
      workspace.setIn(["catalog", name], value);
    }
    writeFileSync(workspaceFile, workspace.toString());
    uiManifest.dependencies = merged.dependencies;
    writeFileSync(uiManifestFile, `${JSON.stringify(uiManifest, null, 2)}\n`);
    run(root, ["install"]);

    console.log("copied:");
    for (const file of copied) console.log(`  ${file}`);
    for (const [name, range] of Object.entries(merged.catalogAdditions))
      console.log(`catalog: added ${name} ${range}`);
  } finally {
    if (!keepScratch) rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) main(process.argv.slice(2));
