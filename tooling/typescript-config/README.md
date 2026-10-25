# @jobyssey/typescript-config

## Purpose

Shared TypeScript compiler settings for every package and app.

## Entry points

- `base.json`: Node-only code (ES2024, NodeNext, strict, no emit, erasable syntax only, `types: ["node"]`).
- `web.json`: extends `base.json` with the DOM libraries and `jsx: "react-jsx"`.

## Rules

- Node-only packages extend `base.json`; packages or apps that hold any `.tsx` extend `web.json` and declare `@types/react` (and `@types/react-dom` when they render) as devDependencies.
- Only `apps/web` sets `"types": ["node", "vite/client"]`, because only it declares `vite`.
- A consuming `tsconfig.json` overrides only `include` and `compilerOptions.types`, and always sets its own `include`: the base's `include` resolves inside this package.
- No `paths` in any tsconfig.
