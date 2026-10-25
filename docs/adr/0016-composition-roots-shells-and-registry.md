# Apps are composition roots; shells and the registry hold the frames

Each app is a one-call composition root that calls its shell and adds nothing else: `apps/api` passes in the adapters and migration sets, and `apps/web` passes in the registry's web features and home path. `packages/api-shell` holds the server frame and `packages/web-shell` the web frame; `packages/registry` holds the one list of core features, and adding or removing a feature edits only its entry points. We picked this because tests build the same app the composition root builds, and any other workspace can compose these packages without editing them.

## Considered Options

- **Mount lines inside the apps**: every new composition copies six files, and the copies drift.
- **An adapter chosen by a string switch inside the port package**: every new adapter edits that package.
