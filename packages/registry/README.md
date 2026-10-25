# @jobyssey/registry

The one list of core features. The API and the web app compose themselves
from it, so they never import a feature package directly.

## Entry points

- `server.ts` (`./server`): `createCoreFeatures(deps)`, the list of
  server features (`Feature`) that `runApi` mounts at
  `/api/<featureName>`.
- `client.tsx` (`./client`): `coreWebFeatures`, the list of web features
  (`WebFeature`) the web shell builds its router from, and `coreHome`, the
  page `/` redirects to.

## Rules

- One line per feature here, nothing else: an import above `// gen:imports`
  and an entry above `// gen:entries` in each file. `pnpm gen:feature`
  inserts its lines before these two markers, so keep them.
- check-workspace CW13 fails when a feature's `server.ts` or `client.tsx` is
  not imported here.
