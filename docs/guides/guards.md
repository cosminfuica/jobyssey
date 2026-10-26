# Guards

`pnpm check` runs every guard in this order and stops at the first failure: `check:workspace`, `lint:files`, `lint:deps`, the package `typecheck`, `lint` and `test` tasks (through turbo), `typecheck:root`, `lint:root`, `lint:boundaries`, `check:migrations`, `lint:unused`, `test:root`. Run one guard alone with `pnpm <script>`.

When a guard fails, fix the code. A guard's list grows only in the places named under [Extend a list](#extend-a-list).

## check-workspace (`pnpm check:workspace`)

`scripts/check-workspace.ts` checks every folder matched by `pnpm-workspace.yaml` against the package anatomy. Each problem prints as `<path>: <message>`, followed by `check-workspace: <n> problem(s)` and exit code 1; exit code 2 means the policy file could not be read.

| Id   | Catches                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| CW01 | A folder matched by a workspace glob without a `package.json`                                                  |
| CW02 | `name` other than `@jobyssey/<folder>`                                                                         |
| CW03 | `private` not `true`                                                                                           |
| CW04 | `type` not `"module"`                                                                                          |
| CW05 | `exports` keys other than the root entry files, or pointing at missing files; an entry file not exported       |
| CW06 | An app with `exports`                                                                                          |
| CW07 | `typecheck`, `lint` and `test` scripts that differ from the standard ones, or `test` without `tests/`          |
| CW08 | A dependency that is not `workspace:*` (internal) or `catalog:` (external)                                     |
| CW09 | A tsconfig that does not extend the shared base or overrides anything besides `types`                          |
| CW10 | An app without `src/`, or a package with `src/` (only `ui` keeps one)                                          |
| CW11 | A feature without `index.ts` and `server.ts` or `client.tsx`; a platform package without an entry file         |
| CW12 | A feature without a `tests/**/*.test.ts(x)` file                                                               |
| CW13 | A feature `server.ts` or `client.tsx` that no registry file imports                                            |
| CW14 | A folder name that is not kebab-case or equals a fixed commit scope                                            |
| CW15 | A `schema.ts` the Drizzle config does not cover, or `pgTable(` outside `schema.ts`                             |
| CW16 | A table in a `schema.ts` without `account_id`, with a nullable one, or without a foreign key to `accounts(id)` |
| CW17 | A `process.env` read outside `envReaders`, `tests/` folders and `*.config.ts`                                  |
| CW18 | A package without `README.md`                                                                                  |

CW16 reads the Drizzle tables. Hand-written SQL can create tables Drizzle never sees, so `findUnscopedTables` in `packages/db/tests/account-scope.integration.test.ts` checks the migrated database too.

## dependency-cruiser (`pnpm lint:boundaries`)

The rules live in `dependency-cruiser.rules.cjs`; `packages/README.md` lists them with one line each. A failure prints the rule name and the import, `from -> to`. Fix the import: use the other package's entry file, move shared code into a package, or turn a value import into `import type`. `tests/boundaries/` holds one fixture per rule.

## ls-lint (`pnpm lint:files`)

`.ls-lint.yml` fixes the file names allowed in each folder: root entry files in `packages/*`, kebab-case in `lib/`, `tests/`, `src/` and `scripts/`. The output names the file and the rule it breaks.

## sherif (`pnpm lint:deps`)

Catches the same dependency declared with different versions across packages, and other manifest drift. Warnings fail too (`failOnWarnings`).

## knip (`pnpm lint:unused`)

Catches unused files, exports and dependencies, including exports from entry files. The output groups findings by kind (`Unused exports`, `Unused dependencies`) with their paths. Delete what is unused.

## check-migrations (`pnpm check:migrations`)

Catches migrations out of order and destructive SQL without the `-- expand-contract: ok` marker; see `migrations.md`.

## TypeScript and oxlint

`pnpm typecheck` and `typecheck:root` run `tsc` with the shared base: `erasableSyntaxOnly` rejects enums, namespaces and parameter properties, `verbatimModuleSyntax` requires `import type` for types, and `NodeNext` rejects extensionless relative imports (TS2835). A relative import ending in `.js` type-checks and passes every guard; it fails only when Node loads the file (`ERR_MODULE_NOT_FOUND`), which `pnpm smoke` and `pnpm start` exercise. `pnpm lint` and `lint:root` run oxlint with type-aware rules (tsgolint) and `--max-warnings 0`; `eslint/no-restricted-properties` rejects `process.env` (also `process["env"]` and `const { env } = process`) outside the composition roots, scripts, config files, config packages and tests. tsgolint embeds TypeScript 7.0.2, so tsconfig files avoid 7.1-only options until tsgolint moves to 7.1: `pnpm lint` and `lint:root` fail with `typescript(tsconfig-error)` on an `es2026` target or lib, and nothing checks `contentMappers` for tsgolint yet (`tsc` rejects it today only because no script passes `--runExternalCode`).

## commitlint and the PR gate

The `commit-msg` hook runs commitlint on every commit (`commits.md`). On pull requests, `.github/workflows/pr-gate.yml` runs `scripts/pr-gate.ts`, which prints one line per problem, such as a template section left empty or a missing linked issue (`pull-requests.md`).

## Extend a list

These are the only legitimate ways to widen a guard:

- `workspace-policy.json`: add a platform package to `platform`, a registry to `registries`, an environment reader to `envReaders`, a Drizzle config to `drizzleConfigs`. dependency-cruiser and check-workspace both read it.
- A table without `account_id`: add it to `SHARED_TABLES` in `packages/db/index.ts` and to `sharedTables` in `workspace-policy.json`. A root test fails when the two differ.
- `knip.jsonc` `ignoreDependencies` for a dependency knip cannot see (imported only from CSS, for example), with a comment saying why.
- `/** @public */` on an export that only another workspace consumes, so knip keeps it.
