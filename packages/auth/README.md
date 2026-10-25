# @jobyssey/auth

The login port: how a request is mapped to an account (public ADR 0004).

## Exports (`index.ts`)

- `AuthAdapter`: the port.
  - `name`: the adapter's name, for logs.
  - `resolveAccount(request)` returns the `AccountId` the request belongs to.
  - `routes?`: a Hono app for login methods that need callbacks. The shell
    mounts it at `/api/auth` when present.
- `createNoneAdapter({ db })`: the `none` adapter for a self-hosted install
  without logins. It calls `ensureSingleAccount(db)` once, at creation, and
  maps every request to that account. It has no `routes`.

## Adapter rule

One file per adapter in `lib/`, chosen by the composition root. This package
holds no config key and no selection switch: the app that starts the server
builds the adapter it wants and passes it in. A new login method is a new file
in `lib/` plus its factory exported from `index.ts`.

## Tests

`tests/auth.integration.test.ts` runs on PGlite, and on Postgres when
`TEST_DATABASE_URL` is set.
