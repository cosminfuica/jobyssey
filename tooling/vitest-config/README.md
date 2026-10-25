# @jobyssey/vitest-config

## Purpose

Shared Vitest projects for package tests.

## Entry points

`index.ts` exports `createVitestConfig({ integration })` with the projects:

- `unit`: `tests/**/*.test.{ts,tsx}` without integration tests.
- `integration-pglite`: `tests/**/*.integration.test.{ts,tsx}` with `TEST_DB=pglite`.
- `integration-postgres`: the same files with `TEST_DB=postgres`, enabled only when `TEST_DATABASE_URL` is set.

`integration` defaults to `true`.

## Rules

- A package with tests lists `@jobyssey/vitest-config` and `vitest` as devDependencies.
- `passWithNoTests` is `false`: a package with a `tests/` folder and no test files fails.
