# Architecture

This file is the map: where code lives, which rule holds each part in place and which check fails when a rule breaks. It names files rather than linking them, so search for a name to find it. The words are defined in `GLOSSARY.md`.

## Bird's eye view

Jobyssey is one server. A Hono API on Node 26 serves `/api/*` and the built React web app from the same port, and stores data in Postgres: PGlite (an embedded Postgres in a data folder) by default, a Postgres server when `DATABASE_URL` is set. Node runs the TypeScript directly; there is no build step for server code.

The code is a pnpm workspace. Apps are thin composition roots, packages hold the behavior, and every feature is one package.

## Codemap

### `apps/`

Composition roots. An app wires packages together and holds no logic, no feature code and no `exports`.

- `apps/api`: `src/main.ts` is one `runApiOrExit` call from `@jobyssey/api-shell` with the `none` login adapter from `@jobyssey/auth`, `coreMigrations` from `@jobyssey/db` and `createCoreFeatures` from `@jobyssey/registry/server`. `src/dev.ts` adds the Vite dev server's host to `ALLOWED_HOSTS` and imports `main.ts`. These two files are the only ones that read `process.env`.
- `apps/web`: `src/main.tsx` builds the router with `createAppRouter` from `@jobyssey/web-shell/client` and renders it. `src/features.tsx` re-exports the feature list from `@jobyssey/registry/client`. `src/styles.css` imports the theme and declares the Tailwind `@source` folders. `vite.config.ts` serves on port 5173 and proxies `/api` to `127.0.0.1:4180`.

### `packages/`

Everything else. `packages/README.md` describes the anatomy. There are four kinds:

- Feature packages (`system`, and every package `pnpm gen:feature` creates): one product capability each, with root entry files `index.ts`, `server.ts`, `schema.ts`, `client.tsx`, `shared.ts`, code in `lib/` and tests in `tests/`. `packages/system` is the reference feature the generator copies.
- Platform packages, the list `platform` in `workspace-policy.json`: `db` (open, lock, migrate, snapshot), `accounts` (the `accounts` table and the single-account bootstrap), `auth` (the login port and its adapters), `api-shell` (settings, security guards, problem+json errors, startup), `web-shell` (header, providers, router) and `ui` (shadcn components and theme).
- The registry, `packages/registry`: `server.ts` and `client.tsx` are the one list of core features. Apps import the registry, not a feature, by convention (no check enforces this yet).
- `packages/ui` is the one package with subfolder exports (`./components/*`, `./lib/*`, `./hooks/*`, `./globals.css`) and a `src/` folder, because the shadcn CLI generates it.

### `tooling/`

Config packages with no runtime code: `typescript-config` (`base.json`, `web.json`), `oxlint-config` (`index.ts`) and `vitest-config` (`index.ts`, `createVitestConfig()`). They import nothing from `apps/` or `packages/`.

### `scripts/`

Repository commands, run by root `package.json` scripts: `check-workspace.ts` (package anatomy, CW01-CW18), `check-migrations.ts`, `gen-feature.ts` (with `lib/feature-gen.ts`), `shadcn-add.ts` (`pnpm ui:add`), `smoke.ts`, `pr-gate.ts` (with `lib/pr-gate.ts`), and `lib/workspace.ts` (the workspace folders and the fixed commit scopes). `scripts/github/` holds `apply-repo-settings.sh`, `labels.json` and `rulesets/main.json`, which the owner runs by hand. Tests sit next to each script as `*.test.ts`.

### `tests/`

Root-level tests, run by `pnpm test:root`: `tests/boundaries/` (one fixture tree per dependency-cruiser rule, `boundaries.test.ts` asserts the exact rules each one breaks) and `tests/fixtures/` (migration folders for `check-migrations`, pull request payloads for the PR gate).

### `docs/`

`docs/guides/` (how-to pages for contributors) and `docs/agents/` (notes for coding agents). `docs/README.md` is the index.

### Root files

`package.json` (scripts), `pnpm-workspace.yaml` (workspace globs, the version catalog), `turbo.json` (task graph), `workspace-policy.json`, `.dependency-cruiser.cjs` and `dependency-cruiser.rules.cjs`, `.ls-lint.yml`, `knip.jsonc`, `oxlint.config.ts`, `commitlint.config.ts` and `commitlint.pr.config.ts`, `vitest.config.ts`, `tsconfig.json` (root scripts and tests), `tsconfig.depcruise.json`, `.husky/` (git hooks), `.github/` (workflows, templates, CODEOWNERS, Renovate, release-please config and manifest, and the community files `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CLA.md`), `GLOSSARY.md`. `docs/PRODUCT.md` is the product context for design tools.

A file stays at the root only when a tool or reader looks for it there: the configs above, `README.md`, `LICENSE`, `CONTRIBUTING.md`, `AGENTS.md`, `ARCHITECTURE.md` and `GLOSSARY.md`. A workspace that nests this repository at `core/` loads `dependency-cruiser.rules.cjs` and `commitlint.config.ts` by path, and oxlint finds `oxlint.config.ts` by walking up from each package, so they stay at the root too.

## Where does X go

| Kind of file                  | Location                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Feature code                  | `packages/<feature>/`: root entry files, `lib/` for the rest. Create it with `pnpm gen:feature <name>`. |
| A feature's tables            | `packages/<feature>/schema.ts`, each table with `account_id`                                            |
| Platform code                 | `packages/<platform>/`, listed in `platform` in `workspace-policy.json`                                 |
| Shared UI components          | `packages/ui/src/components/`, added with `pnpm ui:add <name>`                                          |
| Composition (wiring packages) | `apps/<app>/src/`; the feature list in `packages/registry/server.ts` and `client.tsx`                   |
| Shared config                 | `tooling/<name>/`                                                                                       |
| Repository scripts            | `scripts/`, plus a root `package.json` script                                                           |
| Package tests                 | `packages/<name>/tests/*.test.ts(x)`, `*.integration.test.ts(x)` for database tests                     |
| Script and boundary tests     | `scripts/**/*.test.ts`, `tests/**/*.test.ts`                                                            |
| Fixtures                      | `tests/fixtures/`, `tests/boundaries/fixtures/`, `packages/<name>/tests/fixtures/`                      |
| Guides                        | `docs/guides/`                                                                                          |
| Migrations                    | `packages/db/migrations/`, generated by `pnpm db:generate`                                              |
| Generator                     | `scripts/gen-feature.ts`, `scripts/lib/feature-gen.ts`; the template is `packages/system`               |
| Agent docs                    | `AGENTS.md` (repository root only), `docs/agents/`; a folder's own rules go in its `README.md`          |
| Reserved: end-to-end tests    | `e2e/` (not created yet)                                                                                |
| Reserved: command-line tool   | `apps/cli/` (not created yet)                                                                           |
| Reserved: translations        | `packages/i18n/` (not created yet)                                                                      |

## Invariants and their enforcers

Each rule below fails a named check; `pnpm check` runs all of them, and CI runs `pnpm check`. `docs/guides/guards.md` explains each check's output. The one list of platform packages, apps, registries, shared tables and environment readers is `workspace-policy.json`; dependency-cruiser and `check-workspace` both read it.

| Invariant                                                                            | Enforcer                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No runtime import cycles                                                             | `.dependency-cruiser.cjs` rule `no-circular`                                                                                                                                                     |
| Every import resolves                                                                | `not-to-unresolvable`                                                                                                                                                                            |
| Every npm import is declared in the importing package                                | `no-undeclared-dependency`                                                                                                                                                                       |
| Packages reach other packages only through root entry files                          | `package-internals-private`                                                                                                                                                                      |
| Tests use other packages through entry points                                        | `tests-through-entrypoints`                                                                                                                                                                      |
| Apps import `index.ts`, `server.ts`, `shared.ts`, `client.tsx` only                  | `apps-use-entrypoints`                                                                                                                                                                           |
| Packages and tooling never import apps                                               | `packages-never-import-apps`                                                                                                                                                                     |
| Apps never import other apps                                                         | `apps-never-import-apps`                                                                                                                                                                         |
| Platform packages never import features or the registry                              | `platform-never-imports-features`                                                                                                                                                                |
| Browser code imports no values from `index.ts`, `server.ts`, `schema.ts`             | `client-code-no-node-values`                                                                                                                                                                     |
| Node code imports no `.tsx`, `ui`, `web-shell` or React                              | `node-code-no-tsx-or-react`                                                                                                                                                                      |
| `shared.ts` stays browser-safe                                                       | `shared-is-browser-safe`, `shared-no-node-builtins`                                                                                                                                              |
| A `schema.ts` is imported only by its package, another `schema.ts` and `packages/db` | `schema-imports-restricted`                                                                                                                                                                      |
| `tooling/` imports nothing from the workspace                                        | `tooling-is-leaf`                                                                                                                                                                                |
| Package manifest: name, `private`, ESM, scripts, `catalog:`/`workspace:*` specifiers | `scripts/check-workspace.ts` CW02, CW03, CW04, CW07, CW08                                                                                                                                        |
| `exports` lists only root entry files; apps have none                                | CW05, CW06, and package.json `exports` itself (Node refuses other subpaths)                                                                                                                      |
| tsconfig extends the shared base and overrides only `types` (so no `paths`)          | CW09                                                                                                                                                                                             |
| Layout: apps use `src/`, packages use root entry files and `lib/`                    | CW10, CW11, and `.ls-lint.yml` (file names per folder)                                                                                                                                           |
| A feature has tests and is registered in the registry                                | CW12, CW13                                                                                                                                                                                       |
| Every per-account table has `account_id NOT NULL REFERENCES accounts(id)`            | CW16, and `findUnscopedTables` in `packages/db/tests/account-scope.integration.test.ts`                                                                                                          |
| Tables live only in a package's `schema.ts`, covered by the Drizzle config           | CW15                                                                                                                                                                                             |
| Only `workspace-policy.json` `envReaders` read `process.env`                         | CW17, and oxlint `eslint/no-restricted-properties`                                                                                                                                               |
| Kebab-case folder names, a README per package, no folder named like a fixed scope    | CW14, CW18, `.ls-lint.yml`                                                                                                                                                                       |
| One version per dependency across the workspace                                      | sherif (`pnpm lint:deps`), `catalogMode: strict` in `pnpm-workspace.yaml`                                                                                                                        |
| No unused files, exports or dependencies                                             | `knip.jsonc` (`pnpm lint:unused`)                                                                                                                                                                |
| Migrations stay in order and never drop data unmarked                                | `pnpm check:migrations`; a destructive statement passes only when its `.sql` file has the line `-- expand-contract: ok`                                                                          |
| Commit messages are Conventional Commits with a workspace scope                      | commitlint (`.husky/commit-msg`, CI on pull request titles)                                                                                                                                      |
| Pull requests fill the template, link an accepted issue, disclose AI use             | pr-gate (`scripts/pr-gate.ts`, `.github/workflows/pr-gate.yml`)                                                                                                                                  |
| Rule files have an owner who reviews changes                                         | `.github/CODEOWNERS`                                                                                                                                                                             |
| No enums, namespaces or parameter properties; type-only imports are explicit         | tsconfig flags `erasableSyntaxOnly`, `verbatimModuleSyntax`                                                                                                                                      |
| Relative imports carry `.ts`/`.tsx` extensions                                       | tsconfig `module: NodeNext` rejects extensionless relative imports (TS2835); a `.js` extension type-checks and fails only when Node loads the file, which `pnpm smoke` and `pnpm start` exercise |

## File extensions

`.ts` files are Node-safe; browser-only files use `.tsx`. Node never loads a `.tsx` file (`node-code-no-tsx-or-react`), so a feature's `index.ts`, `server.ts`, `schema.ts` and `shared.ts` run on Node, and `client.tsx` with everything it imports runs in the browser. `shared.ts` is the one file both sides import.

## Composition model

- Shells hold the frames: `@jobyssey/api-shell` runs the server, `@jobyssey/web-shell` renders the app. They know nothing about features.
- The registry holds the list: `createCoreFeatures` (`packages/registry/server.ts`) and `coreWebFeatures` (`packages/registry/client.tsx`). `pnpm gen:feature` adds a line above the `// gen:imports` and `// gen:entries` markers.
- Adapters plug in at the composition root: `runApi` takes `createAuth`, so `apps/api` passes `createNoneAdapter`. Packages hold no adapter switch and no config key that picks one.
- Migration sets are passed in: `runApi` takes `migrationSets`, and `apps/api` passes `[coreMigrations]`. Each set has its own bookkeeping table.

Another workspace composes these packages the same way: its own app calls `runApi` with its own adapters, feature list and migration sets, `dependency-cruiser.rules.cjs` exports `build(prefix, policy)` to apply the same rules to a nested checkout, and `createCommitlintConfig` accepts extra scopes.

## Request flow

1. The browser loads the web app: in development from Vite on port 5173, in production as static files the API serves from `apps/web/dist` (unknown paths get `index.html`).
2. The app calls `/api/<feature>/...`; in development Vite proxies it to `127.0.0.1:4180`.
3. `createApp` in `packages/api-shell/lib/app.ts` runs the guards in order: host guard (a loopback `Host` with the bound port, or an `ALLOWED_HOSTS` entry), cross-site guard (`Sec-Fetch-Site` and `Origin` on unsafe methods), JSON-only bodies under `/api/*`, then the request log.
4. `/api/auth` goes to the login adapter's routes, when it has any.
5. Every other `/api/*` request passes the account middleware: `auth.resolveAccount(request)` sets `accountId`.
6. The feature's Hono routes, mounted at `/api/<name>`, read `c.get("accountId")` and query the database through `db`.
7. Errors and unknown `/api/*` paths answer `application/problem+json`.

## Startup order

`runApi` in `packages/api-shell/lib/run.ts`:

1. `loadConfig(env)` parses the settings and refuses a non-loopback `HOST` without `JOBYSSEY_ALLOW_REMOTE=1`.
2. `openDatabase` opens PGlite and takes `jobyssey.lock` in the data folder (or connects to `DATABASE_URL`).
3. `migrateDatabase` snapshots an existing PGlite folder to `backups/`, then applies each migration set in order.
4. `createAuth({ db })` builds the login adapter; `createFeatures(deps)` builds the features.
5. `createApp` builds the Hono app; the server listens and logs `Jobyssey listening on <url>`.
6. SIGINT and SIGTERM close the server, then the database, which releases the lock.
