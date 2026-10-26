# Migrations

Migrations live in `packages/db/migrations` (SQL files plus Drizzle's `meta/` folder). `pnpm check:migrations` checks them; run `node scripts/check-migrations.ts <folder>` to check another folder.

## Add a table

1. Declare the table in your feature's `schema.ts` (a table that holds account data needs `account_id`).
2. Run `pnpm db:generate`.
3. Commit the new `.sql` file, the new `meta/NNNN_snapshot.json` and the changed `meta/_journal.json` together with the `schema.ts` change.

## Never edit an applied migration

An installation that already applied a migration never runs it again, so an edit reaches fresh installs only and the two databases drift apart. Fix a mistake with a new migration. A migration that is not merged yet may be deleted and regenerated.

## Destructive changes: expand, then contract

A release never drops or rewrites data that the previous release still reads. Split the change across two releases:

1. Expand: add the new column or table, copy the data, and make the code read the new place. Nothing is dropped.
2. Contract: in a later release, once no supported release reads the old place, drop it.

`pnpm check:migrations` fails on `DROP TABLE|COLUMN|SCHEMA|TYPE|INDEX|CONSTRAINT`, `TRUNCATE`, `ALTER TABLE ... ALTER COLUMN ... TYPE` and `ALTER TABLE ... RENAME` unless the same `.sql` file has this line on its own:

```sql
-- expand-contract: ok
```

Add it only in the contract migration. The check reads SQL with a regular expression, so those words inside a comment or a string also fail it; the marker line clears them.

## Order matters

Drizzle 0.x compares a migration's `when` timestamp only with the newest migration the database has already applied, and silently skips any older one. A migration merged after a newer one is therefore never run. The check fails when `idx` or `when` in `meta/_journal.json` do not increase, when a journal entry has no `.sql` file and when a `.sql` file is not in the journal. After rebasing onto a newer migration, delete your unmerged migration and run `pnpm db:generate` again.

## Another workspace adds its own set

A set is a `MigrationSet` with a `name`, a `folder` and its own `table` (see `coreMigrations` in `packages/db/index.ts`). Two sets must never share a table, because Drizzle tracks progress per table; `migrateDatabase` throws if they do. Pass every set to `migrateDatabase(handle, { sets: [...] })` and run `node scripts/check-migrations.ts <its folder>` in that workspace's checks.

## Restore a pre-migration snapshot

Before the app applies pending migrations to an existing local database (PGlite), it copies the database to `backups/pre-migrate-<stamp>.tar.gz` inside the data directory; the five newest copies are kept.

1. Stop the app.
2. Move `pgdata` aside: `mv pgdata pgdata.broken`.
3. Extract the snapshot into a new `pgdata`: `mkdir pgdata && tar -xzf backups/pre-migrate-<stamp>.tar.gz -C pgdata`.
4. Start the previous release.

## Stale lock file

`jobyssey.lock` in the data directory holds the PID of the process using it. If startup says another Jobyssey process is using the folder, check that PID (`ps -p <pid>`). Delete `jobyssey.lock` only when no Jobyssey process runs.
