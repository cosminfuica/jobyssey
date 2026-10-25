# PostgreSQL everywhere; local installs embed it with PGlite

Jobyssey uses PostgreSQL everywhere, so there is one SQL dialect for schemas, migrations and queries. A local install runs on the Job Seeker's computer with no Docker (`pnpm install && pnpm start`) and embeds Postgres in the app with PGlite, storing data in a local folder; setting `DATABASE_URL` connects to any Postgres server instead. The app runs on the host, not in a container, because the Harnesses it uses (ADR 0014) are installed and logged in there (on macOS, Claude Code keeps its login in the Keychain, which a container cannot reach).

## Considered Options

- **Docker Compose with the app and Postgres**: the Harnesses and their logins live outside the container.
- **App on the host, Postgres in Docker**: every Job Seeker installs Docker just for the database.
- **Embedded SQLite**: a second SQL dialect next to Postgres servers.

## Consequences

- PGlite is pre-1.0 (0.5.11 in October 2026) and serves one connection at a time, which is enough for one Job Seeker. Only one process may open a data folder, so the app holds a lock file while running.
- Two database drivers (PGlite and a Postgres server) run the same schema, so CI runs the integration tests against both.
- The app snapshots a local database before applying migrations; a manual backup is a copy of the data folder taken while the app is stopped.
