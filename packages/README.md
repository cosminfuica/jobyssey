# packages

Every package here is a deep module: a small set of root entry files in front of code nobody else imports. `ARCHITECTURE.md` shows how they fit together.

## Package kinds

- **Feature**: one product capability, such as `system`. Any package not listed below is a feature, so check-workspace holds it to the strictest rules (CW11, CW12, CW13).
- **Platform**: the packages listed in `platform` in `workspace-policy.json` (`db`, `accounts`, `auth`, `api-shell`, `web-shell`, `ui`). They never import features.
- **Registry** (`registry`, listed in `registries`): the one list of core features, `server.ts` and `client.tsx`. Apps import it instead of importing features, by convention (no check enforces this yet).
- **UI** (`ui`, listed in `subpathExports`): the shadcn kit. It keeps `src/` and exports `./components/*`, `./lib/*`, `./hooks/*` and `./globals.css` instead of root entry files.

## Anatomy

| File         | Holds                                                                                     | Runs on       |
| ------------ | ----------------------------------------------------------------------------------------- | ------------- |
| `index.ts`   | The logic other packages call                                                             | Node          |
| `server.ts`  | Hono routes and the `Feature` the API shell mounts at `/api/<name>`                       | Node          |
| `schema.ts`  | Drizzle tables; every per-account table has `account_id NOT NULL REFERENCES accounts(id)` | Node          |
| `client.tsx` | Pages, query hooks and the `WebFeature`                                                   | Browser       |
| `shared.ts`  | Names, paths and types both sides use                                                     | Browser, Node |
| `lib/`       | Everything else; private to the package                                                   | either        |
| `tests/`     | `*.test.ts(x)` and `*.integration.test.ts(x)`, through the entry points                   | Node (Vitest) |
| `README.md`  | `## Purpose`, `## Entry points`, `## Rules`                                               |               |

`package.json` `exports` maps `.`, `./server`, `./schema`, `./client` and `./shared` to these files and nothing else (CW05).

## Boundary rules

dependency-cruiser (`pnpm lint:boundaries`, rules in `dependency-cruiser.rules.cjs`):

- `no-circular`: no runtime import cycles; a cycle of `import type` only is allowed.
- `not-to-unresolvable`: every import resolves to a file or an installed package.
- `no-undeclared-dependency`: every npm import is declared in the importing package's `package.json`.
- `package-internals-private`: a package reaches other packages only through their root entry files (and `ui`'s public folders).
- `tests-through-entrypoints`: a package's tests reach packages through entry points, their own `tests/` files excepted.
- `apps-use-entrypoints`: apps import `index.ts`, `server.ts`, `shared.ts` and `client.tsx` only, never `schema.ts`.
- `packages-never-import-apps`: packages and tooling never import apps.
- `apps-never-import-apps`: code two apps share belongs in a package.
- `platform-never-imports-features`: platform packages never import features or the registry.
- `client-code-no-node-values`: browser code imports no values from `index.ts`, `server.ts` or `schema.ts`; `import type` is allowed.
- `node-code-no-tsx-or-react`: Node code imports no `.tsx` file, `ui`, `web-shell` or React.
- `shared-is-browser-safe`: `shared.ts` imports no values from `index.ts`, `server.ts`, `schema.ts` and no server-only or React library.
- `shared-no-node-builtins`: `shared.ts` imports no Node built-in.
- `schema-imports-restricted`: a `schema.ts` is imported only by its own package, another `schema.ts` (foreign keys) and `packages/db`.
- `tooling-is-leaf`: `tooling/` imports nothing from `apps/` or `packages/`.

## Anatomy checks

`scripts/check-workspace.ts` (`pnpm check:workspace`) checks CW01-CW18: folder has a `package.json` (CW01), name (CW02), `private` (CW03), ESM (CW04), `exports` (CW05), apps without exports (CW06), scripts (CW07), `catalog:`/`workspace:*` specifiers (CW08), tsconfig (CW09), layout (CW10), entry files per kind (CW11), feature tests (CW12), registration (CW13), folder name (CW14), schema coverage (CW15), account scope (CW16), `process.env` readers (CW17), README (CW18). `docs/guides/guards.md` explains each one.

## Add a feature

Run `pnpm gen:feature <name>`. It copies `packages/system`, renames it and registers it; see `docs/guides/add-a-feature.md`.

## Add an adapter

Add one file to the port package's `lib/` (for a login method, `packages/auth/lib/<name>.ts`), export its factory from the package's `index.ts`, and pass it from the composition root (`createAuth` in `apps/api/src/main.ts`). The port package holds no switch that picks an adapter.
