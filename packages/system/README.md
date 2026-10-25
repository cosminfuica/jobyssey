# @jobyssey/system

## Purpose

`@jobyssey/system` is the reference feature: every new feature is generated
from a copy of this package with the name replaced. It answers
`GET /api/system/status` with the version, Node, database driver and
account, and shows them on the `/system` page.

## Entry points

A feature package keeps five entry files at its root; code that outgrows them
moves to `lib/`.

- `index.ts` (`.`): the logic, run on Node. The status function is pure: it
  takes the version, the database driver and the account id and returns the
  status.
- `server.ts` (`./server`): the Hono routes and the `Feature` the API shell
  mounts at `/api/<featureName>`. Handlers are chained so `hc<typeof routes>`
  sees every route.
- `client.tsx` (`./client`): the browser code: a typed Hono client, a
  TanStack Query hook, the status page and the `WebFeature` that adds the
  page and its header link to the web shell. It imports `server.ts` with
  `import type` only.
- `shared.ts` (`./shared`): constants and types used on both sides: the
  feature name, the page paths and the response type. No Node built-ins and
  no values from `index.ts`, `server.ts` or `schema.ts`.
- `schema.ts` (`./schema`): this feature has no tables. A feature that
  stores data adds its Drizzle tables here, each with an `account_id`
  column, and reads only its own tables.

## Rules

- It is the generator's template (`pnpm gen:feature`): a change here reaches every feature generated afterwards. CI's gen-feature job generates a probe feature from it and runs the checks on the copy.
- It must stay registered in `packages/registry` (check-workspace CW13).

## Tests

Unit tests in `tests/` go through the entry points: they mount the routes
behind a middleware that sets the account and request `/status`, and call
the status function directly.
