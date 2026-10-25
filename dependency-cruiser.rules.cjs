// @ts-check
// Import boundaries for apps/, packages/ and tooling/ (ADR 0003, 0004, 0013).
//
// `build(prefix, policy)` returns the dependency-cruiser config. `prefix` is
// prepended to every anchored path regex, so another workspace can apply the
// same rules to a nested checkout (build("core/") checks core/apps, ...).
// `policy` is workspace-policy.json, the one list every workspace guard reads.
//
// Entry points are a package's root files: index.ts, server.ts, schema.ts,
// client.tsx and shared.ts. Everything in a package subfolder is private.
// Convention: `.ts` files are Node-safe; browser-only files use `.tsx`.

const path = require("node:path");

/** @param {string} prefix @param {string} re */
function prefixAnchors(prefix, re) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // An anchor that starts the regex or follows `(` or `|`; `[^` is a negated class and stays.
  return re.replace(/(^|[(|])\^/g, (_match, before) => `${before}^${escaped}`);
}

/** @param {unknown} node @param {string} prefix @returns {any} */
function rewrite(node, prefix) {
  if (Array.isArray(node)) return node.map((item) => rewrite(item, prefix));
  if (node === null || typeof node !== "object") return node;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if ((key === "path" || key === "pathNot") && typeof value === "string")
      out[key] = prefixAnchors(prefix, value);
    else if ((key === "path" || key === "pathNot") && Array.isArray(value))
      out[key] = value.map((re) => prefixAnchors(prefix, re));
    else out[key] = rewrite(value, prefix);
  }
  return out;
}

/**
 * @param {string} [prefix]
 * @param {{ platform: string[], nodeApps: string[], webApps: string[] }} [policy]
 * @returns {import("dependency-cruiser").IConfiguration}
 */
function build(prefix = "", policy = require("./workspace-policy.json")) {
  const platform = policy.platform.join("|");
  const nodeApps = policy.nodeApps.join("|");
  const webApps = policy.webApps.join("|");
  const uiPublic = [
    "^packages/ui/src/(components|lib|hooks)/",
    "^packages/ui/src/styles/globals\\.css$",
  ];

  /** @type {import("dependency-cruiser").IConfiguration} */
  const config = {
    forbidden: [
      {
        name: "no-circular",
        comment:
          "No runtime dependency cycles. A cycle made only of type-only imports is erased at compile time and allowed.",
        severity: "error",
        from: {},
        to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
      },
      {
        name: "not-to-unresolvable",
        comment:
          "Every import must resolve to a file or an installed package; a typo or a missing file fails here.",
        severity: "error",
        from: {},
        to: { couldNotResolve: true },
      },
      {
        name: "no-undeclared-dependency",
        comment:
          "Every npm import must be declared in the importing workspace package's package.json.",
        severity: "error",
        from: {},
        to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
      },
      {
        name: "package-internals-private",
        comment:
          "A package imports its own files freely, but reaches other packages only through their entry points (and the ui package's public src folders).",
        severity: "error",
        from: { path: "^packages/([^/]+)/" },
        to: {
          path: "^packages/[^/]+/",
          pathNot: [
            "^packages/$1/",
            "^packages/[^/]+/(index|server|schema|shared)\\.ts$",
            "^packages/[^/]+/client\\.tsx$",
            ...uiPublic,
          ],
        },
      },
      {
        name: "tests-through-entrypoints",
        comment:
          "A package's tests use packages through their entry points like everyone else; only their own tests/ files are reachable inside a folder.",
        severity: "error",
        from: { path: "^packages/([^/]+)/tests/" },
        to: {
          path: "^packages/[^/]+/[^/]+/",
          pathNot: ["^packages/$1/tests/", ...uiPublic],
        },
      },
      {
        name: "apps-use-entrypoints",
        comment:
          "Apps import packages through index.ts, server.ts, shared.ts and client.tsx only; schema.ts is for other packages' foreign keys, never for apps.",
        severity: "error",
        from: { path: "^apps/" },
        to: {
          path: "^packages/",
          pathNot: [
            "^packages/[^/]+/(index|server|shared)\\.ts$",
            "^packages/[^/]+/client\\.tsx$",
            ...uiPublic,
          ],
        },
      },
      {
        name: "packages-never-import-apps",
        comment:
          "Apps compose packages; packages and tooling never import apps.",
        severity: "error",
        from: { path: "^(packages|tooling)/" },
        to: { path: "^apps/" },
      },
      {
        name: "apps-never-import-apps",
        comment:
          "Apps are leaves: code shared between apps belongs in a package.",
        severity: "error",
        from: { path: "^apps/([^/]+)/" },
        to: { path: "^apps/", pathNot: "^apps/$1/" },
      },
      {
        name: "platform-never-imports-features",
        comment:
          "Platform packages (workspace-policy.json `platform`) never import feature packages or the registry; features plug in through the registry.",
        severity: "error",
        from: { path: `^packages/(${platform})/` },
        to: { path: "^packages/", pathNot: `^packages/(${platform})/` },
      },
      {
        name: "client-code-no-node-values",
        comment:
          "Browser code (every .tsx file, web apps, ui, web-shell) never imports values from index.ts, server.ts or schema.ts; `import type` is erased and allowed.",
        severity: "error",
        from: {
          path: `(\\.tsx$|^apps/(${webApps})/|^packages/ui/|^packages/web-shell/)`,
        },
        to: {
          path: "^packages/[^/]+/(index|server|schema)\\.ts$",
          dependencyTypesNot: ["type-only"],
        },
      },
      {
        name: "node-code-no-tsx-or-react",
        comment:
          "Node code (node apps, every package .ts entry point and lib .ts file, the server-side platform packages) never imports .tsx files, ui, web-shell or React.",
        severity: "error",
        from: {
          path: `(^apps/(${nodeApps})/|^packages/[^/]+/(index|server|schema|shared)\\.ts$|^packages/[^/]+/lib/.*\\.ts$|^packages/(db|accounts|auth|api-shell)/)`,
        },
        to: {
          path: "(\\.tsx$|^packages/ui/|^packages/web-shell/|node_modules/(react|react-dom|@tanstack/react-[^/]+)/)",
        },
      },
      {
        name: "shared-is-browser-safe",
        comment:
          "shared.ts runs in the browser and on Node: no values from index.ts, server.ts or schema.ts and no server-only or React libraries.",
        severity: "error",
        from: { path: "^packages/[^/]+/shared\\.ts$" },
        to: {
          path: "(^packages/[^/]+/(index|server|schema)\\.ts$|node_modules/(drizzle-orm|pg|@electric-sql|hono|@hono|pino|react|react-dom)/)",
          dependencyTypesNot: ["type-only"],
        },
      },
      {
        name: "shared-no-node-builtins",
        comment: "shared.ts runs in the browser: no Node built-in modules.",
        severity: "error",
        from: { path: "^packages/[^/]+/shared\\.ts$" },
        to: { dependencyTypes: ["core"] },
      },
      {
        name: "schema-imports-restricted",
        comment:
          "A package's schema.ts is imported only by its own package, by another schema.ts (foreign keys) and by packages/db.",
        severity: "error",
        from: {
          path: "^packages/([^/]+)/",
          pathNot: ["^packages/[^/]+/schema\\.ts$", "^packages/db/"],
        },
        to: { path: "^packages/[^/]+/schema\\.ts$", pathNot: "^packages/$1/" },
      },
      {
        name: "tooling-is-leaf",
        comment:
          "Config packages under tooling/ never import apps or packages.",
        severity: "error",
        from: { path: "^tooling/" },
        to: { path: "^(apps|packages)/" },
      },
    ],
    options: {
      doNotFollow: { path: "node_modules" },
      tsPreCompilationDeps: true,
      tsConfig: { fileName: path.join(__dirname, "tsconfig.depcruise.json") },
      enhancedResolveOptions: {
        extensions: [".ts", ".tsx", ".js", ".json"],
        conditionNames: ["import", "node", "default"],
        exportsFields: ["exports"],
      },
      // Build output is never scanned. node_modules stays out of exclude: an excluded path also drops
      // every edge to it, which would silence the npm rules; doNotFollow keeps it unscanned.
      exclude: { path: "^(apps|packages|tooling)/[^/]+/(dist|\\.turbo)/" },
    },
  };
  return rewrite(config, prefix);
}

module.exports = { build };
