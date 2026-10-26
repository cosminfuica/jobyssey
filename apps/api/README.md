# @jobyssey/api

The API app: the local composition root that serves the API and the built
web app.

## Purpose

`src/main.ts` is one `runApiOrExit` call from `@jobyssey/api-shell`: the
`none` login adapter, the core migration set and the core features from
`@jobyssey/registry`. It serves `apps/web/dist` when it exists.
`src/dev.ts` also allows the Vite dev server's host (port 5173) and then
runs `main.ts`.

## Entry points

None: apps are not imported. `pnpm --filter @jobyssey/api start` runs
`src/main.ts`; `dev` runs `src/dev.ts` with `node --watch`.

## Rules

- `src/main.ts` stays one `runApiOrExit` call: no feature code and no logic
  here. Features are listed in `@jobyssey/registry`, behavior lives in
  `@jobyssey/api-shell`.
- Only `src/main.ts` and `src/dev.ts` read `process.env` (check-workspace
  CW17); everything else takes its values from `loadConfig`.
- Another workspace composes the same packages with its own login adapter and
  feature list; this app stays the local one.
- There is no `tests/` folder: tests live in the packages, and `pnpm smoke`
  boots this app.

## Where to look

| Change                | Location                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Add a feature         | `pnpm gen:feature <name>` creates and registers it; CW13 fails on an unregistered feature |
| Add a setting         | `packages/api-shell/lib/config.ts`; that package's README lists what else changes         |
| Change the middleware | `packages/api-shell/lib/app.ts` (order) and `packages/api-shell/lib/security.ts` (guards) |
| Add a login method    | `packages/auth/lib/<name>.ts`, passed as `createAuth` in `src/main.ts`                    |
| Serve the web app     | `apps/web/dist`: `pnpm start` builds it first; the API looks for it once, at startup      |
