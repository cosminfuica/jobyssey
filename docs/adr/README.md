# Architecture decision records

Each ADR is one short file, `NNNN-slug.md`, numbered in order: a title and one paragraph saying what was decided and why, with Considered Options or Consequences only when they add something. An ADR that adds a rule names the check that enforces it.

- [0001](0001-monorepo-thin-apps-deep-packages.md): Monorepo with thin apps and deep-module packages
- [0002](0002-postgres-everywhere-pglite-locally.md): PostgreSQL everywhere; local installs embed it with PGlite
- [0003](0003-one-package-per-feature.md): One package per feature, mounted by thin apps
- [0004](0004-entry-points-and-adapters.md): Features talk through entry points; outside services plug in as adapters
- [0005](0005-hono-api-serves-react-web-app.md): One server: Hono API serving a React + Vite web app
- [0006](0006-functional-source-license.md): Functional Source License (FSL-1.1-ALv2)
- [0007](0007-drizzle-per-feature-tables.md): Drizzle ORM, per-feature tables, migrations on startup
- [0008](0008-vercel-ai-sdk-behind-llm-package.md): Vercel AI SDK behind one `llm` package
- [0009](0009-no-login-for-local-installs.md): No login for local installs; login methods are adapters
- [0010](0010-job-sources.md): Job Sources: one package, structured countries
- [0011](0011-modes-typed-tools-typed-results.md): Modes: short instructions, typed tools, typed results
- [0012](0012-pg-boss-queue-for-runs.md): Runs execute from a Postgres-backed queue (pg-boss)
- [0013](0013-account-scoped-data-shared-postings.md): Account-scoped data, shared Job Posting catalogue
- [0014](0014-harnesses-and-jobyssey-cli.md): Any Harness runs Modes; tools are a `jobyssey` CLI
- [0015](0015-node-26-runs-typescript-directly.md): Node 26 runs the API's TypeScript directly
- [0016](0016-composition-roots-shells-and-registry.md): Apps are composition roots; shells and the registry hold the frames
- [0017](0017-conventional-commits-squash-merges-release-please.md): Conventional Commits, squash merges and release-please
- [0018](0018-contribution-gate-and-ai-assistance.md): Contribution gate and AI assistance
- [0019](0019-structure-enforced-by-checks.md): Every structure rule is enforced by a check
