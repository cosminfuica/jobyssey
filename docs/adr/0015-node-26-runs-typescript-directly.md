# Node 26 runs the API's TypeScript directly

`apps/api` and the packages run as TypeScript source on Node 26 (long-term support from 2026-10-28) through Node's built-in type stripping, with no build step; only `apps/web` is built, by Vite. TypeScript is configured with `erasableSyntaxOnly`, `verbatimModuleSyntax` and `allowImportingTsExtensions`, so enums, namespaces and path aliases are not used, and relative imports carry their `.ts` extension. TypeScript stays on 6.0.x while typescript-eslint (peer `<6.1.0`) and dependency-cruiser 18 need it.

## Considered Options

- **Bundling `apps/api` with tsdown**: allows all TypeScript syntax, but adds a build step to every start.
- **Node 24**: its active support ended on 2026-10-20.

## Consequences

- Node does not strip types from `.tsx` files, so code Node runs never imports a `client.tsx` (ADR 0003).
- Node refuses to strip types inside `node_modules`; workspace packages resolve through pnpm symlinks to their real `packages/` paths, so this works in a checkout (verified October 2026). A Docker image must copy the workspace as-is instead of using `pnpm deploy`.
- Node 25 and later no longer bundle corepack, so contributors install pnpm themselves.
