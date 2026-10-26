# @jobyssey/db

## Purpose

Database access for every server-side package: opens PGlite (an embedded
Postgres in a data folder) or a Postgres server, and runs migrations.

## Entry points

`index.ts`:

- `openDatabase({ dataDir, databaseUrl? })` returns a `DatabaseHandle`
  (`db`, `driver`, `dataDir`, `fresh`, `close()`). With `databaseUrl` it
  connects to that Postgres server; with `dataDir: "memory://"` it opens an
  in-memory PGlite; otherwise it opens PGlite in `<dataDir>/pgdata` and holds
  `<dataDir>/jobyssey.lock` until `close()`. `fresh` is true when the folder
  was created by this open.
- `acquireDataDirLock(dataDir)` and `DataDirLockedError`: the lock behind
  `openDatabase`. A second open of the same folder (in this process or another
  live one) throws `DataDirLockedError`; a lock left by a dead process is taken
  over.
- `migrateDatabase(handle, { sets, log? })` applies migration sets and returns
  `{ applied, snapshot? }`.
- `coreMigrations`: the migration set generated from every package's
  `schema.ts` into `migrations/`.
- `SHARED_TABLES`: tables that are not account-scoped. Keep it equal to
  `sharedTables` in `workspace-policy.json`; a root test pins them.
- Types `Db`, `DbDriver`, `DatabaseHandle`, `MigrationSet`.

## Migration sets

A `MigrationSet` is `{ name, folder, table }`: a Drizzle migrations folder and
the bookkeeping table (in the `drizzle` schema) that records which of its
migrations ran. Sets run in array order, so a later set may reference tables
of an earlier one. Every set needs its own table, because Drizzle compares a
migration's timestamp only with the newest row of that table;
`migrateDatabase` rejects two sets that share one.

Before applying pending migrations to an existing PGlite folder,
`migrateDatabase` writes `<dataDir>/backups/pre-migrate-<time>.tar.gz` and
keeps the newest 5. On Postgres it holds an advisory lock, so two servers
starting together migrate one after the other.

## Rules

- Tables live in each package's `schema.ts`, never here (check-workspace CW15); per-account tables need `account_id` (CW16).
- Migrations stay in order and mark destructive statements (`pnpm check:migrations`).
- Never edit a migration that `main` already has: a database that ran it never runs it again, and no check catches the edit. Fix it with a new migration (`docs/guides/migrations.md`).

### Adding a table

1. Edit the owning package's `schema.ts` (per-account tables need
   `account_id NOT NULL REFERENCES accounts(id)`).
2. Run `pnpm db:generate` at the repository root.
3. Commit the new files under `packages/db/migrations/`.

## Where to look

| Change                                      | Location            | Notes                                                                             |
| ------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| Driver choice, open and close               | `lib/open.ts`       | `databaseUrl` wins over `dataDir`; `memory://` takes no lock                      |
| The lock file                               | `lib/lock.ts`       | Taking over a stale lock is not atomic (see its `shortcut:` comment)              |
| Migration runs                              | `lib/migrate.ts`    | Advisory lock 727001; `packages/accounts` holds 727002; a new lock needs a new id |
| Pre-migrate backups                         | `lib/snapshot.ts`   | Called by `migrateDatabase`                                                       |
| Which `schema.ts` files `db:generate` reads | `drizzle.config.ts` | `../*/schema.ts`: only a package's root `schema.ts`                               |

## Tests

- `tests/lock.test.ts` needs no database; the `*.integration.test.ts` files
  open real ones.
- Migration fixtures live in `tests/fixtures/migrations-*/`.
- Close every handle a test opens: an open PGlite folder keeps
  `jobyssey.lock`, and this process cannot open the folder again until then.
