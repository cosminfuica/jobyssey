# Testing

## Where tests live

- Package tests: `packages/<name>/tests/`. Run them with `pnpm test` (all packages) or `pnpm --filter @jobyssey/<name> test`.
- Script and boundary tests: `scripts/**/*.test.ts` and `tests/**/*.test.ts`, run by `pnpm test:root` through the root `vitest.config.ts`.
- Apps have no tests; their behavior lives in packages. `pnpm smoke` boots the built app.

Tests import packages through their entry points (dependency-cruiser `tests-through-entrypoints`).

## Projects

Each package's `vitest.config.ts` calls `createVitestConfig()` from `@jobyssey/vitest-config`, which defines three projects:

| Project                | Files                                  | Database                                         |
| ---------------------- | -------------------------------------- | ------------------------------------------------ |
| `unit`                 | `tests/**/*.test.{ts,tsx}`             | none                                             |
| `integration-pglite`   | `tests/**/*.integration.test.{ts,tsx}` | PGlite (`TEST_DB=pglite`)                        |
| `integration-postgres` | the same files                         | the server at `TEST_DATABASE_URL`, only when set |

## Postgres locally

CI runs the integration tests against Postgres 17. To do the same locally with Docker:

```sh
docker run -d --rm --name jobyssey-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
timeout 60 bash -c 'until docker exec jobyssey-pg pg_isready -h 127.0.0.1 -U postgres; do sleep 1; done'
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres pnpm test
docker stop jobyssey-pg
```

`pg_isready` uses `-h 127.0.0.1` on purpose: the Unix socket already answers during the container's temporary init server, just before Postgres restarts. Docker is a test tool only; Jobyssey never needs it to run.

## No sleeps

A test waits for the event it needs (a child process's output line, an `exit` event, a health check) with a bounded timeout, never for a fixed time. A test that passes by timing luck is a bug.
