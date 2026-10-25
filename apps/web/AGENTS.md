# apps/web

- The router comes from `createAppRouter` in `@jobyssey/web-shell/client`; the feature list comes from `@jobyssey/registry/client` (re-exported by `src/features.tsx`).
- UI components come from `@jobyssey/ui`. `pnpm ui:add <name>` from the repository root wraps the shadcn CLI and updates the catalog.
- Tailwind sources are declared with `@source` lines in `src/styles.css`.
- Never import a feature package directly: add it to the registry. dependency-cruiser `apps-use-entrypoints` and `client-code-no-node-values` fail on deep or server-value imports.
