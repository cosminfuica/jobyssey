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

- No feature code and no logic here: features are listed in
  `@jobyssey/registry`, behavior lives in `@jobyssey/api-shell`.
- Only `src/main.ts` and `src/dev.ts` read `process.env` (check-workspace
  CW17); everything else takes its values from `loadConfig`.
- Another workspace composes the same packages with its own login adapter and
  feature list; this app stays the local one.
