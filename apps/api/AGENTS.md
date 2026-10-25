# apps/api

- This app is one `runApiOrExit` call in `src/main.ts`; keep it that way.
- Add features in `packages/registry/server.ts` (or with `pnpm gen:feature <name>`), never here. check-workspace CW13 fails when a feature's `server.ts` is not imported by the registry, and dependency-cruiser `apps-use-entrypoints` fails on imports past a package's entry files.
- Settings come from `loadConfig` in `@jobyssey/api-shell`. Only `src/main.ts` and `src/dev.ts` read `process.env` (CW17).
- The security middleware order lives in `packages/api-shell/lib/app.ts`.
- Errors are `application/problem+json`, built with `problem()` from `@jobyssey/api-shell`.
- Tests live in the packages; this app has no `tests/` folder.
