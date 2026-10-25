# AGENTS.md

The map for coding agents. The closest `AGENTS.md` or `README.md` to the file you change adds the local rules.

## Read first

- `ARCHITECTURE.md`: where each kind of file goes and which check enforces each rule.
- `GLOSSARY.md`: the project's words; use them in names, issues and tests.
- The ADRs in `docs/adr/` for the area you touch.
- The closest `README.md` or `AGENTS.md` (`apps/api/AGENTS.md`, `apps/web/AGENTS.md`, `packages/README.md`, each package's `README.md`).

## Commands

- `pnpm install`: install the workspace (pnpm only; Node 26 from `.nvmrc`).
- `pnpm dev`: the API on 127.0.0.1:4180 with `node --watch` and the web app on 5173 (Vite). Stopping it through turbo can leave `jobyssey.lock` in the data folder; the next start takes over a lock whose PID is gone.
- `pnpm start`: build the web app, then serve it and the API on 127.0.0.1:4180.
- `pnpm check`: every guard, typecheck, lint and test. It must exit 0 before a commit.
- `pnpm test`: package tests only.
- `pnpm gen:feature <name>`: create and register a feature package (`docs/guides/add-a-feature.md`).
- `pnpm db:generate`: generate migrations from the `schema.ts` files.
- `pnpm check:migrations`: check migration order and destructive statements.
- `pnpm smoke`: boot the built app on a temporary data folder and probe it (run `pnpm build` first).

## Rules with their enforcer

- Import only a package's root entry files: dependency-cruiser `package-internals-private`, `apps-use-entrypoints`, `tests-through-entrypoints` (`pnpm lint:boundaries`).
- Node code stays out of the browser and React stays out of Node: `client-code-no-node-values`, `node-code-no-tsx-or-react`, `shared-is-browser-safe`.
- Platform packages never import features: `platform-never-imports-features`. Apps get features from `packages/registry`; CW13 fails when a feature is not registered there.
- Every per-account table has `account_id NOT NULL REFERENCES accounts(id)`: `check-workspace` CW16 and the `findUnscopedTables` test.
- Package anatomy (manifest, exports, tsconfig, layout, tests, registration, README): `check-workspace` CW01-CW18 (`pnpm check:workspace`).
- Only `apps/api/src/main.ts` and `dev.ts` read `process.env`: CW17 and ESLint `no-restricted-syntax`.
- Versions live in the catalog of `pnpm-workspace.yaml`: CW08 and sherif.
- No unused exports or dependencies: knip (`pnpm lint:unused`).
- File and folder names: ls-lint (`pnpm lint:files`).
- Migrations stay in order and never drop data unmarked: `pnpm check:migrations` rejects `DROP`, `TRUNCATE`, column type changes and renames unless the migration file has the line `-- expand-contract: ok`.

`docs/guides/guards.md` explains each check's output and the legitimate ways to extend its lists.

## Commits and pull requests

- Conventional Commits with a workspace folder or a fixed scope (`repo`, `deps`, `docs`, `github`, `release`): commitlint in `.husky/commit-msg` (`docs/guides/commits.md`).
- Add `Assisted-by: <tool> (<model>)` to a contributor pull request when AI helped.
- Fill every section of `.github/pull_request_template.md` and link an accepted issue: the pr-gate workflow checks it (`docs/guides/pull-requests.md`).
- Commit with hooks on. When a check fails, fix the code; a check changes only through a reviewed change to the check itself.

## Scratch space

Scratch files go to `.omo/session-work/` and evidence to `.omo/evidence/` (both gitignored).

## Issue tracker and labels

- `docs/agents/issue-tracker.md`: GitHub Issues through the `gh` CLI.
- `docs/agents/triage-labels.md`: the triage label strings.

## Domain docs

`docs/agents/domain.md`: how to use `GLOSSARY.md` and the ADRs.

## Harness notes

`docs/agents/harness.md`: how an orchestrating agent delegates, phrases and verifies work.

## Local extensions

`.husky/pre-commit` runs `<git common dir>/hooks/pre-commit.local` when it exists and is executable; maintainers may install local checks there.
