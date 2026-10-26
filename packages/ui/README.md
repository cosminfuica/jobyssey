# @jobyssey/ui

## Purpose

The UI kit: shadcn/ui components (style `radix-nova`) and the theme tokens
every web app imports.

## Entry points

- `@jobyssey/ui/globals.css`: Tailwind, the theme tokens (`:root` and
  `.dark`) and the base layer. It has no `@source` lines: each app's
  stylesheet declares which folders Tailwind scans.
- `@jobyssey/ui/components/<name>`: one file per component, such as
  `button` and `card`.
- `@jobyssey/ui/lib/<name>` and `@jobyssey/ui/hooks/<name>`: helpers the
  components use.

This is the one package with subfolder exports instead of root entry files:
the shadcn CLI generates the files under `src/` and the components import
each other as `@jobyssey/ui/components/<name>`.

## Adding a component

Run `pnpm ui:add <name...>` from the repository root, for example
`pnpm ui:add dialog`. The script (`scripts/shadcn-add.ts`) runs the shadcn
CLI in a scratch project, because the CLI resolves its aliases through
tsconfig `paths`, which this repo does not use. It copies the generated
files here, adds the packages they import to the catalog in
`pnpm-workspace.yaml` and to this package as `catalog:`, and runs
`pnpm install`. There is no `components.json` in the repo.

## Rules

- Do not edit `src/components/*` by hand: `pnpm ui:add` overwrites them.
  Compose them in the package that uses them instead.
- Versions live in the catalog; this package lists `catalog:` only.
