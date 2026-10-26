# Project knowledge base

**Generated:** 2026-10-26
**Commit:** a59cdaf
**Branch:** main

The map for coding agents. This is the repository's only `AGENTS.md`: below the root, each folder's local rules live in its `README.md` (no check enforces this yet). Read the closest one before you change a file.

## Overview

Jobyssey is one local server: a Hono API on Node 26 serves `/api/*` and the built React web app on 127.0.0.1:4180, and keeps data in PGlite (an embedded Postgres in a data folder) or the Postgres server at `DATABASE_URL`. It is a pnpm workspace: apps are composition roots, packages hold the behavior, and each feature is one package. Node runs the TypeScript directly; server code has no build step.

## Read first

- `ARCHITECTURE.md`: where each kind of file goes and which check enforces each rule.
- `GLOSSARY.md`: the project's words; use them in names, issues and tests.
- The closest `README.md`: `packages/README.md` for every package, then the package's own; `apps/api/README.md`, `apps/web/README.md`, `scripts/README.md`.

## Structure

```text
apps/api/              composition root: one runApiOrExit call
apps/web/              Vite + React root; the API serves its dist/
packages/system/       the reference feature, copied by pnpm gen:feature
packages/registry/     the feature list both apps load; gen:feature edits it
packages/ui/           shadcn kit from pnpm ui:add; the only package with src/
packages/<platform>/   db, accounts, auth, api-shell, web-shell (and ui)
tooling/               shared TypeScript, ESLint and Vitest config packages
scripts/               guards, generators, smoke test, PR gate; not a package
tests/                 root tests: boundary fixtures, migration and PR fixtures
workspace-policy.json  the lists check-workspace and dependency-cruiser read
```

## Where to look

| Task                   | Location                                              | Notes                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a feature          | `pnpm gen:feature <name>`                             | Removal is by hand (`docs/guides/add-a-feature.md`)                                                                                                        |
| Add a table            | the feature's `schema.ts`, then `pnpm db:generate`    | `docs/guides/migrations.md`                                                                                                                                |
| Add an API route       | `packages/<feature>/server.ts`                        | Mounted at `/api/<feature>`                                                                                                                                |
| Add a page             | `packages/<feature>/client.tsx`, paths in `shared.ts` | `/` redirects to `coreHome` in `packages/registry/client.tsx`                                                                                              |
| Add a UI component     | `pnpm ui:add <name>`                                  | `packages/ui/README.md`                                                                                                                                    |
| Add a setting          | `packages/api-shell/lib/config.ts`                    | Its README lists what else changes                                                                                                                         |
| Add a login method     | `packages/auth/lib/<name>.ts`                         | Passed as `createAuth` in `apps/api/src/main.ts`                                                                                                           |
| Add a platform package | `platform` in `workspace-policy.json`                 | `dependency-cruiser.rules.cjs` also hardcodes package lists: server-only ones in `node-code-no-tsx-or-react`, browser ones in `client-code-no-node-values` |
| Change a guard         | `scripts/`, `dependency-cruiser.rules.cjs`            | `docs/guides/guards.md`                                                                                                                                    |
| Add a CI job           | `.github/workflows/ci.yml`                            | Add it to the `needs` of `ci-summary`, the only required check from `ci.yml`                                                                               |
| Release                | release-please on `main`                              | `docs/guides/releasing.md`; nobody edits `CHANGELOG.md` or the version by hand                                                                             |

## Code map

Refs: other files that use the symbol.

| Symbol               | Type     | Location                         | Refs | Role                                                              |
| -------------------- | -------- | -------------------------------- | ---- | ----------------------------------------------------------------- |
| `Db`                 | type     | `packages/db/lib/open.ts`        | 9    | The Drizzle handle every query goes through                       |
| `AccountId`          | type     | `packages/accounts/index.ts`     | 8    | The account a request runs as                                     |
| `openDatabase`       | function | `packages/db/lib/open.ts`        | 7    | Opens a PGlite folder (taking `jobyssey.lock`) or Postgres        |
| `Feature`            | type     | `packages/api-shell/index.ts`    | 7    | `{ name, routes }`, mounted at `/api/<name>`                      |
| `migrateDatabase`    | function | `packages/db/lib/migrate.ts`     | 6    | Applies migration sets; snapshots an existing PGlite folder first |
| `createApp`          | function | `packages/api-shell/lib/app.ts`  | 6    | The Hono app: guards, features, static web app                    |
| `createVitestConfig` | function | `tooling/vitest-config/index.ts` | 6    | The unit and integration test projects                            |
| `coreMigrations`     | const    | `packages/db/index.ts`           | 5    | The core migration set                                            |
| `AuthAdapter`        | type     | `packages/auth/index.ts`         | 5    | The login port                                                    |
| `FeatureDeps`        | type     | `packages/api-shell/index.ts`    | 4    | What `createFeatures` receives                                    |
| `problem`            | function | `packages/api-shell/index.ts`    | 3    | Builds `application/problem+json` responses                       |
| `WebFeature`         | type     | `packages/web-shell/client.tsx`  | 3    | A feature's route and nav entry                                   |
| `runApiOrExit`       | function | `packages/api-shell/lib/run.ts`  | 2    | Starts the server; exits 1 on a config or lock error              |
| `createCoreFeatures` | function | `packages/registry/server.ts`    | 1    | The server feature list `apps/api` passes in                      |
| `coreWebFeatures`    | const    | `packages/registry/client.tsx`   | 1    | The web feature list `apps/web` renders                           |

## Commands

- `pnpm install`: install the workspace (pnpm only; Node 26 from `.nvmrc`).
- `pnpm dev`: the API on 127.0.0.1:4180 with `node --watch` and the web app on 5173 (Vite). Stopping it through turbo can leave `jobyssey.lock` in the data folder; the next start takes over a lock whose PID is gone.
- `pnpm start`: build the web app, then serve it and the API on 127.0.0.1:4180.
- `pnpm check`: every guard, typecheck, lint and test. It must exit 0 before a commit.
- `pnpm test`: package tests only; `pnpm test:root` runs the tests in `scripts/` and `tests/`.
- `pnpm gen:feature <name>`: create and register a feature package (`docs/guides/add-a-feature.md`).
- `pnpm db:generate`: generate migrations from the `schema.ts` files.
- `pnpm check:migrations`: check migration order and destructive statements.
- `pnpm smoke`: boot the built app on a temporary data folder and probe it (run `pnpm build` first).

## Rules with their enforcer

- Import only a package's root entry files: dependency-cruiser `package-internals-private`, `apps-use-entrypoints`, `tests-through-entrypoints` (`pnpm lint:boundaries`).
- Node code stays out of the browser and React stays out of Node: `client-code-no-node-values`, `node-code-no-tsx-or-react`, `shared-is-browser-safe`.
- Platform packages never import features: `platform-never-imports-features`. Apps get features from `packages/registry` by convention (no check enforces it yet); CW13 fails when a feature is not registered there.
- Every per-account table has `account_id NOT NULL REFERENCES accounts(id)`: `check-workspace` CW16 and the `findUnscopedTables` test.
- Package anatomy (manifest, exports, tsconfig, layout, tests, registration, README): `check-workspace` CW01-CW18 (`pnpm check:workspace`).
- In apps and packages, only `apps/api/src/main.ts` and `dev.ts` read `process.env` (files under `tests/` and `*.config.ts` files are exempt): CW17 and ESLint `no-restricted-syntax`.
- Versions live in the catalog of `pnpm-workspace.yaml`: CW08 and sherif.
- No unused exports or dependencies: knip (`pnpm lint:unused`).
- File and folder names: ls-lint (`pnpm lint:files`).
- Migrations stay in order and never drop data unmarked: `pnpm check:migrations` rejects `DROP`, `TRUNCATE`, column type changes and renames unless the migration file has the line `-- expand-contract: ok`.

`docs/guides/guards.md` explains each check's output and the legitimate ways to extend its lists.

## Conventions

- Relative imports end in `.ts` or `.tsx`. A `.js` extension type-checks and fails only when Node loads the file, which `pnpm smoke` and `pnpm start` exercise.
- Node never loads a `.tsx` file: browser-only code, `lib/` helpers included, goes in `.tsx` (`node-code-no-tsx-or-react`).
- Type-only imports use `import type` (ESLint `consistent-type-imports`).
- HTTP errors are `application/problem+json` responses from `problem()`. Code logs through the pino `Logger`; only `scripts/` call `console`.
- Database tests are `*.integration.test.ts(x)`: they run on PGlite, and again on Postgres when `TEST_DATABASE_URL` is set. Tests wait for events with bounded timeouts, never fixed sleeps (`docs/guides/testing.md`).
- Known limits are marked with a `shortcut:` comment.
- A document that states a rule names the check that enforces it, or says that no check does yet.

## Commits and pull requests

- Conventional Commits with a workspace folder or a fixed scope (`repo`, `deps`, `docs`, `github`, `release`): commitlint in `.husky/commit-msg` (`docs/guides/commits.md`).
- Add `Assisted-by: <tool> (<model>)` to a contributor pull request when AI helped.
- Fill every section of `.github/pull_request_template.md`; a contributor's pull request also links an accepted issue. The pr-gate workflow checks both (`docs/guides/pull-requests.md`).
- Commit with hooks on. When a check fails, fix the code; a check changes only through a reviewed change to the check itself.

## Notes

- Scratch files go to `.omo/session-work/` and evidence to `.omo/evidence/` (both gitignored).
- `docs/agents/issue-tracker.md`: GitHub Issues through the `gh` CLI. `docs/agents/triage-labels.md`: the triage label strings.
- `docs/agents/domain.md`: how to use `GLOSSARY.md`. `docs/agents/harness.md`: how an orchestrating agent delegates, phrases and verifies work.
- `.husky/pre-commit` and `.husky/commit-msg` first run `<git common dir>/hooks/pre-commit.local` and `commit-msg.local` when they exist and are executable; maintainers may install local checks there.
