# Runs execute from a Postgres-backed queue (pg-boss)

Runs are queued with pg-boss, which keeps its queue in Postgres and works inside `apps/api`. A Run survives a closed browser tab, retries on failure, and streams progress to the browser over Server-Sent Events, and a local install needs no extra service (pg-boss also runs on PGlite).

## Considered Options

- **BullMQ + Redis**: very mature, but adds Redis to every install.
- **Running inside the HTTP request**: minutes-long Runs time out and die with the tab.
