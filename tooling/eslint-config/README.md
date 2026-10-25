# @jobyssey/eslint-config

## Purpose

Shared ESLint flat config with typed linting (`projectService`).

## Entry points

`index.js` exports:

- `base`: ESLint and typescript-eslint recommended type-checked rules, plus the `process.env` ban, separate type imports, no floating promises and exhaustive switches.
- `react`: `base` plus the React hooks rules.
- `nodeScripts`: Node globals for `.js` files.
- `ignores`: build output, dependencies, Turborepo cache and coverage.

## Rules

- `process.env` is read only in composition roots (`apps/*/src/main.ts`, `dev.ts`), scripts, config files, config packages and tests; everything else reads settings through `loadConfig`.
- Packages apply these rules through the root `eslint.config.js`; no `--fix` in any script.
