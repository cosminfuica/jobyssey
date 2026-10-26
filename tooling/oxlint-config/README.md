# @jobyssey/oxlint-config

## Purpose

Shared oxlint rule sets with type-aware rules (oxlint-tsgolint).

## Entry points

`index.ts` exports:

- `rules`: ESLint's recommended rules and typescript-eslint's recommended type-checked rules under their oxlint names, plus the `process.env` ban, separate type imports, no floating promises and exhaustive switches; the core rules typescript-eslint turns off for TypeScript files stay off.
- `reactRules`: the React hooks rules, from oxlint's `react` plugin.
- `ignores`: build output, dependencies, Turborepo cache and coverage.

## Rules

- `process.env` is read only in composition roots (`apps/*/src/main.ts`, `dev.ts`), scripts, config files, config packages and tests; everything else reads settings through `loadConfig` (`eslint/no-restricted-properties`).
- File globs live in the root `oxlint.config.ts`, which applies `rules` everywhere, `reactRules` to the React globs and the exemptions; no `--fix` in any script.
