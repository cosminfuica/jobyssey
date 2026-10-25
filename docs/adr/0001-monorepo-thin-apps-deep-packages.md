# Monorepo with thin apps and deep-module packages

Frontend and backend live in one pnpm-workspaces monorepo so shared types and cross-cutting changes land in one commit. `apps/` holds the deployables (`apps/web`, `apps/api`) and stays thin; domain logic lives in `packages/` as deep modules behind their entry points, with boundaries enforced by dependency-cruiser. The toolchain is pnpm, Turborepo, Node 26 (ADR 0015) and Vitest; pnpm was picked because it refuses undeclared dependencies, which backs the deep-module rules.

## Considered Options

- **Separate frontend and backend repos**: lose shared types and single-commit changes.
- **Bun as runtime, package manager and test runner**: one tool and faster, but library compatibility gaps, and everyone running Jobyssey would need Bun installed.
- **npm workspaces**: hoisting lets packages use dependencies they never declared.
