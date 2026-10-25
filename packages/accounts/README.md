# @jobyssey/accounts

Accounts: every row of a Job Seeker's data belongs to one (public ADR 0013).
A self-hosted install has exactly one account.

## Exports

- `index.ts`:
  - `AccountId`: a branded string, so a plain string cannot be passed where an
    account id is expected.
  - `ensureSingleAccount(db)` returns the oldest account id and creates an
    account when none exists. Calling it again returns the same id.
  - `getAccount(db, id)` returns `{ id, createdAt }` or `undefined`.
  - `createAccount(db)` creates another account and returns its id (for
    tests and login adapters).
- `schema.ts` (`@jobyssey/accounts/schema`): the `accounts` table (`id`,
  `created_at`). It is the one shared table; every other table needs
  `account_id NOT NULL REFERENCES accounts(id)`. Its migration is generated
  into `packages/db/migrations/` by `pnpm db:generate`.

## Tests

`tests/accounts.integration.test.ts` runs on PGlite, and on Postgres when
`TEST_DATABASE_URL` is set.
