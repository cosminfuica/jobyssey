# Drizzle ORM, per-feature tables, migrations on startup

Data access uses Drizzle ORM (0.45.x, the stable line in October 2026). Each feature package defines its own tables in its `schema.ts`; drizzle-kit generates one shared migration history from all of them into `packages/db/migrations`, and the API applies pending migrations on startup, so upgrading a local install is pulling the new version and restarting.

## Considered Options

- **Prisma**: mature, but one schema file breaks per-feature table ownership and adds a code-generation step.
- **Kysely**: typed query builder only; migrations written by hand.

## Consequences

- Migrations run unattended on Job Seekers' machines, so a release never drops or rewrites data that the previous release still reads: destructive changes are split across two releases (expand, then contract), and a check fails on destructive SQL not marked `-- expand-contract: ok`.
- Drizzle 0.x takes no migration lock and silently skips a migration merged out of order, so the app takes its own lock (a lock file for PGlite, a Postgres advisory lock for servers) and a check fails when migration timestamps are out of order.
- Migrations run as ordered sets, each with its own bookkeeping table, so a workspace that composes these packages can add a set of its own after the core set.
