# One package per feature, mounted by thin apps

Code is organized by feature, not by layer. Each feature is one package in `packages/` that owns its logic, data and routes, and exposes up to five entry points: `index.ts` (domain logic), `schema.ts` (its tables), `server.ts` (API routes), `client.tsx` (UI and typed client) and `shared.ts` (browser-safe constants and types used by both). Finding a feature means opening one folder; removing one means deleting the folder and its import and entry lines in each entry point of `packages/registry`. Lint rules keep browser code from importing values from any `server.ts` (a type-only import carries the typed client) and keep server-side code from importing any `client.tsx`. Node cannot run `.tsx` files, so `client.tsx` is loaded only by Vite.

## Considered Options

- **Layered folders (`controllers/`, `services/`, `models/`)**: spreads every feature across three or more folders and turns removing one into a hunt.
- **UI in `apps/web`, domain in packages**: keeps React out of packages, but splits each feature across two trees.

## Consequences

`packages/ui` is the one package with subfolder exports (`components/*`, `lib/*`, `hooks/*`, `globals.css`), because the shadcn CLI generates components there.
