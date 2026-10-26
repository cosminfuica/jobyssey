# @jobyssey/api-shell

## Purpose

The HTTP server every Jobyssey API runs in: settings, the security guards,
problem+json errors, request logs, feature mounting and startup.

## Entry points

`index.ts` (what features import):

- `Feature`: `{ name, routes }`, where `routes` is a `new Hono<FeatureEnv>()`.
  The shell mounts it at `/api/<name>`.
- `FeatureEnv`: `c.get("accountId")` is the request's `AccountId`.
- `FeatureDeps`: `{ db, driver, version, logger }`, passed to
  `createFeatures`.
- `Logger` (pino), `Config`, `ConfigError`.
- `problem(c, status, title, detail?)`: an RFC 9457
  `application/problem+json` response.

`server.ts` (what composition roots import):

- `runApiOrExit(options)`: what `apps/*/src/main.ts` calls. It prints a
  `ConfigError` or `DataDirLockedError` message and exits with code 1.
- `runApi(options)`: loads settings, opens and migrates the database, builds
  the login adapter and the features, serves the API (and the built web app
  when `webDist` is given) and returns `{ url, close() }`. It rejects instead
  of exiting; tests use it with `PORT: "0"` and `handleSignals: false`.
- `createApp(options)`: the Hono app without a listening server.
- `loadConfig(env)`: parses the settings below.

## Settings

| Name                    | Default            | Meaning                                |
| ----------------------- | ------------------ | -------------------------------------- |
| `HOST`                  | `127.0.0.1`        | Listen address.                        |
| `PORT`                  | `4180`             | Listen port; `0` picks a free port.    |
| `JOBYSSEY_DATA_DIR`     | `~/.jobyssey/data` | PGlite folder (holds `jobyssey.lock`). |
| `DATABASE_URL`          | unset              | A Postgres server instead of PGlite.   |
| `ALLOWED_HOSTS`         | empty              | Extra `Host` values, comma-separated.  |
| `JOBYSSEY_ALLOW_REMOTE` | unset              | `1` allows a non-loopback `HOST`.      |
| `LOG_LEVEL`             | `info`             | pino level, or `silent`.               |

Jobyssey has no login, so a `HOST` other than `127.0.0.1`, `::1` or
`localhost` is refused unless `JOBYSSEY_ALLOW_REMOTE=1`.

## Security

- Host guard: every request's `Host` must be a loopback name with the bound
  port (`127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`) or an
  `ALLOWED_HOSTS` entry; anything else is a 403. This blocks DNS rebinding.
- Cross-site guard: for methods other than GET, HEAD and OPTIONS, a
  `Sec-Fetch-Site` other than `same-origin` or `none` is a 403, and so is an
  `Origin` that is `null` or names another host. Requests with neither header
  (curl, scripts) pass.
- JSON-only bodies under `/api/*`: a body that is not `application/json` is a
  415, so HTML forms cannot post to the API.
- No CORS headers are ever sent.

## Rules

- This package never reads `process.env` (check-workspace CW17); the composition root passes `env`.

### Feature names

Names are unique and `auth` is reserved: the login adapter's `routes` are
mounted at `/api/auth`, before the middleware that resolves the account.

## Where to look

| Change                             | Location          | Notes                                                                                                                                 |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Middleware order, feature mounting | `lib/app.ts`      | The request log runs first, so guard refusals are logged too                                                                          |
| A guard                            | `lib/security.ts` | Refusal tests: `tests/security.test.ts`                                                                                               |
| A setting                          | `lib/config.ts`   | Also add it to the table above and to `passThroughEnv` in `turbo.json`: `pnpm dev` runs through turbo, which drops unlisted variables |
| Startup and shutdown               | `lib/run.ts`      | A failure after the database opens closes it, which releases the lock                                                                 |
| Serving the built web app          | `lib/app.ts`      | `webDist` is checked once, in `createApp`: a web build made after startup needs a restart                                             |
| Error bodies                       | `lib/errors.ts`   | An unhandled error answers 500 with no message or stack in the body                                                                   |
| Tests                              | `tests/`          | Unit tests drive `createApp` in-process; `run.integration.test.ts` boots a real server with `runApi`                                  |
