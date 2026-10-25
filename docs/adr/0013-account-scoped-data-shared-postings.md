# Account-scoped data, shared Job Posting catalogue

Every row of a Job Seeker's data carries an `account_id`; repository functions take the account as a parameter, and a schema test fails if any table not explicitly marked as shared lacks a non-null `account_id` referencing `accounts`. Job Postings form one shared, de-duplicated catalogue keyed by Job Source and the source's own posting id, so each posting is fetched once no matter how many accounts save it; saved, evaluated and applied state is stored per account. A feature may reference another feature's tables only through that feature's `schema.ts` entry point, for foreign keys, never for queries.

## Considered Options

- **Postgres row-level security now**: the database enforces isolation, but it complicates PGlite, pg-boss and migrations. Revisit before any deployment serves more than one account.
- **Job Postings per account**: full isolation, but the same posting would be fetched once per account.

## Consequences

ADR 0004's "never queries another feature's tables" has one exception: `schema.ts` imports for foreign keys, enforced by a boundary rule.
