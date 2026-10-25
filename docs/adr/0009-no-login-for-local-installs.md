# No login for local installs; login methods are adapters

A local install has no login: every request acts as the install's single account. Login is an adapter (ADR 0004) passed in by the composition root, so a login method can be added later without touching features.

## Considered Options

- **A password for local installs**: protects against other people on a shared computer, but adds a step for the common single-user case.

## Consequences

The API binds to `127.0.0.1` by default and refuses to start on a non-loopback address unless `JOBYSSEY_ALLOW_REMOTE=1` is set. Binding to localhost alone does not stop websites open in the owner's browser from sending requests to it, so the API rejects requests whose `Host` is not an allowed host (blocks DNS rebinding) and state-changing requests whose `Origin` or `Sec-Fetch-Site` is not Jobyssey's own page (blocks cross-site requests), accepts JSON bodies only, and sends no CORS headers. Other programs on the owner's computer can still call it, as can anyone who reaches an install exposed to a network.
