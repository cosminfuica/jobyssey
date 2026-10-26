# @jobyssey/web

The web app: the composition root that Vite builds into `dist/`, which the
API serves in production.

## Purpose

`src/main.tsx` builds the router with `createAppRouter` from
`@jobyssey/web-shell/client` and renders it inside `AppProviders`. The feature
list and the home page come from `src/features.tsx`, which re-exports
`coreWebFeatures` and `coreHome` from `@jobyssey/registry/client`.
`src/styles.css` imports the theme from `@jobyssey/ui` and declares which
sources Tailwind scans: every package under `packages/` and this app's `src/`.

## Entry points

None: apps are not imported.

## Rules

- No feature code and no feature imports here: features live in packages and
  reach this app only through `@jobyssey/registry/client`. This is a
  convention: dependency-cruiser `apps-use-entrypoints` still allows an import
  of a feature's `client.tsx`.
- `pnpm --filter @jobyssey/web dev` serves on port 5173 and proxies `/api`
  to the API on 127.0.0.1:4180; `build` writes `dist/`.
- A new folder whose files use Tailwind classes needs an `@source` line in
  `src/styles.css`; Tailwind skips `node_modules` and gitignored paths.

## Where to look

| Change                    | Location                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| Router, header, providers | `packages/web-shell/client.tsx`                                         |
| A page or nav entry       | the feature's `client.tsx` (its `WebFeature`)                           |
| The page `/` redirects to | `coreHome` in `packages/registry/client.tsx`                            |
| A UI component            | `pnpm ui:add <name>` from the repository root (`packages/ui/README.md`) |
| The theme                 | `packages/ui/src/styles/globals.css`                                    |
