# @jobyssey/web

The web app: the composition root that Vite builds into `dist/`, which the
API serves in production.

## Purpose

`src/main.tsx` builds the router from `src/features.tsx` with
`@jobyssey/web-shell` and renders it. `src/styles.css` imports the theme
from `@jobyssey/ui` and declares which sources Tailwind scans: every
package under `packages/` and this app's `src/`.

## Entry points

None: apps are not imported.

## Rules

- No feature code here: features live in packages and are listed in
  `@jobyssey/registry` (`client.tsx`); `src/features.tsx` only re-exports
  that list.
- `pnpm --filter @jobyssey/web dev` serves on port 5173 and proxies `/api`
  to the API on 127.0.0.1:4180; `build` writes `dist/`.
- A new folder whose files use Tailwind classes needs an `@source` line in
  `src/styles.css`; Tailwind skips `node_modules` and gitignored paths.
