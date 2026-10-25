# Boundary fixtures

`boundaries.test.ts` runs dependency-cruiser with the root `.dependency-cruiser.cjs` inside each fixture under `fixtures/` and asserts the exact set of violated rules. Each fixture holds tiny `apps/`, `packages/` and `tooling/` trees with relative imports only.

- `ok-entrypoint`: a package imports its own `lib/`, another package's `index.ts`, an app imports a package `index.ts` -> none
- `deep-import`: `packages/b/index.ts` imports `packages/a/lib/x.ts` -> `package-internals-private`
- `test-imports-own-lib`: `packages/a/tests/x.test.ts` imports `../lib/x.ts` -> `tests-through-entrypoints`
- `app-imports-internal`: `apps/api` imports `packages/a/lib/x.ts` -> `apps-use-entrypoints`
- `web-imports-server-value`: `apps/web` imports a value from `packages/a/server.ts` -> `client-code-no-node-values`
- `web-imports-server-type`: `apps/web` uses `import type` from `packages/a/server.ts` -> none
- `web-imports-index-value`: `apps/web` imports a value from `packages/a/index.ts` -> `client-code-no-node-values`
- `lib-tsx-imports-server-value`: `packages/a/client.tsx` -> `lib/page.tsx` -> `../server.ts` value -> `client-code-no-node-values`
- `lib-ts-imports-tsx`: `packages/a/lib/helper.ts` imports `./page.tsx` -> `node-code-no-tsx-or-react`
- `api-imports-tsx`: `apps/api/src/main.ts` imports `./view.tsx` -> `node-code-no-tsx-or-react`
- `unresolvable-import`: `packages/a/index.ts` imports `./missing.ts` -> `not-to-unresolvable`
- `foreign-schema`: `packages/b/server.ts` imports `packages/a/schema.ts` -> `schema-imports-restricted`
- `schema-to-schema`: `packages/b/schema.ts` imports `packages/a/schema.ts` -> none
- `cycle`: value imports `packages/a/index.ts` -> `packages/b/index.ts` -> `packages/a/index.ts` -> `no-circular`
- `type-cycle`: the same cycle with `import type` only -> none
- `platform-imports-feature`: `packages/db/index.ts` imports `packages/system/index.ts` -> `platform-never-imports-features`
- `registry-imports-feature`: `packages/registry/server.ts` imports `packages/system/server.ts` -> none
- `package-imports-app`: `packages/a/index.ts` imports `apps/api/src/main.ts` -> `packages-never-import-apps`
- `app-imports-app`: `apps/web` imports `apps/api` -> `apps-never-import-apps`
- `shared-imports-index`: `packages/a/shared.ts` imports `./index.ts` -> `shared-is-browser-safe`
- `shared-imports-node-builtin`: `packages/a/shared.ts` imports `node:fs` -> `shared-no-node-builtins`
- `tooling-imports-package`: `tooling/x/index.ts` imports `packages/a/index.ts` -> `tooling-is-leaf`
- `core-prefix`: `deep-import` nested under `core/`, checked with `build("core/")` -> `package-internals-private`

Bare `@jobyssey/*` imports cannot resolve here (no `node_modules`), so `exports` resolution and `no-undeclared-dependency` are proven on the real tree.
