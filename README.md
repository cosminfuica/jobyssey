# Jobyssey

Jobyssey is a web app that helps people find a job. A Job Seeker runs it on their own computer, in the browser, with their own LLM Provider or Harness. It finds Job Postings from Job Sources in any country or region the Job Seeker picks, and its AI work runs as Modes with fixed instructions, tools and result shapes, so results are predictable and token use stays low.

**Status:** Early development: the workspace foundation is in place, product features are not built yet.

## Requirements

- Node 26. The version is pinned in `.nvmrc`, so `nvm use` or `fnm use` picks it up.
- pnpm 12. Install it with pnpm's standalone installer from https://pnpm.io/installation (Node 25 and later no longer bundle corepack), or run `npm install -g pnpm@12` if you already have npm.

## Supported platforms

Linux and macOS are what the maintainer runs. Windows is expected to work, because the runtime path is Node and pnpm only, but it isn't tested yet. CI runs on Linux.

## Privacy

The app sends no telemetry and makes no outbound calls, and adding either needs an ADR. `pnpm start` runs the app only; pnpm itself may contact the npm registry for installs, for its pinned version or for update checks, which is the package manager's behaviour, not the app's. The development commands use Turborepo, which collects anonymous usage data that contributors can switch off with `pnpm exec turbo telemetry disable`, as [CONTRIBUTING.md](CONTRIBUTING.md) says.

## Quick start

```bash
pnpm install
pnpm start
```

Then open http://127.0.0.1:4180.

- Your data lives in `~/.jobyssey/data`. Set `JOBYSSEY_DATA_DIR` to use another folder.
- Set `DATABASE_URL` to use a Postgres server instead of the built-in database.
- Run one Jobyssey process per data folder. A second process on the same folder stops with an error, because the first one holds a lock on it.

## Development

- `pnpm dev` runs the API and the web app with reload.
- `pnpm check` runs the main checks: types, lint, tests, boundaries, migrations and the workspace guards.
- `pnpm test` runs the package tests against the in-process database. Set `TEST_DATABASE_URL` to a Postgres server to run the integration tests against Postgres as well.
- `pnpm gen:feature <name>` creates a new feature package.
- `pnpm db:generate` writes a migration after a schema change.

## Project layout

```text
apps/
  api/          Node server: the API, and the built web app
  web/          React web app
packages/
  db/           database access and migrations
  accounts/     accounts
  auth/         login adapters
  api-shell/    shared API server setup
  web-shell/    shared web app shell
  ui/           UI components
  registry/     the list of features both apps load
  system/       system status feature
tooling/        shared TypeScript, ESLint and Vitest config
scripts/        workspace checks, generators and repo tools
docs/           ADRs, guides and agent notes
```

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md): how the parts fit together.
- [docs/adr/](docs/adr/): the decisions and why they were made.
- [GLOSSARY.md](GLOSSARY.md): the words the project uses.
- [packages/README.md](packages/README.md): rules for packages.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute, including the AI-assistance policy.
- [SECURITY.md](SECURITY.md): how to report a vulnerability.

## License

Functional Source License 1.1 with Apache 2.0 future license (FSL-1.1-ALv2): source-available, and each release becomes Apache 2.0 two years after it ships. See [LICENSE](LICENSE).
