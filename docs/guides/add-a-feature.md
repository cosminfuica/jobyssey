# Add a feature

A feature is a package under `packages/` with the same anatomy as the reference feature `packages/system`. The generator copies it, so a new feature passes `pnpm check` before you write any code.

## 1. Generate it

```sh
pnpm gen:feature <name>
```

`<name>` is kebab-case (`job-search`): lower-case letters, digits and single dashes, starting with a letter. It must not be a fixed commit scope (`repo`, `deps`, `docs`, `github`, `release`), a platform package, `registry`, `system` or the name of any folder under `apps/`, `packages/` or `tooling/`, because the folder name is also the package name and the commit scope.

The generator:

- copies `packages/system` to `packages/<name>` (without `node_modules`, `.turbo` and `dist`);
- renames every identifier and file name: `system` becomes `<name>`, `systemPaths` becomes `<camel>Paths`, `SystemStatus` becomes `<Pascal>Status`, `SYSTEM_X` becomes `<UPPER>_X`, `tests/system.test.ts` becomes `tests/<name>.test.ts`; it stops and removes the copy if `system` still appears anywhere;
- registers the feature in `packages/registry`: an import and an entry above the `// gen:imports` and `// gen:entries` markers in `server.ts` and `client.tsx`, and `"@jobyssey/<name>": "workspace:*"` in its `package.json`;
- runs `pnpm install`, which links the package and updates `pnpm-lock.yaml`.

It prints the paths it changed and `Next: pnpm check`.

## 2. Make it yours

Edit the copy, entry file by entry file (the package README lists what each one may hold):

1. `shared.ts`: the feature name stays the folder name; set the page paths and the request and response types (DTOs).
2. `schema.ts`: add it when the feature stores data. Every table that holds account data has an `account_id` column, and a feature reads only its own tables.
3. `index.ts`: the logic.
4. `server.ts`: the Hono routes, mounted at `/api/<name>`. Keep the handlers chained so the typed client sees every route.
5. `client.tsx`: the pages, the TanStack Query hooks and the `WebFeature` with its nav label (the generator leaves the reference wording, such as `<Pascal> status`, for you to replace).
6. `README.md` and `tests/`: describe and test what the feature does now.

## 3. Generate migrations

When you added or changed tables, run `pnpm db:generate` and commit the migration files with the schema change (see [migrations.md](migrations.md)).

## 4. Check and commit

```sh
pnpm check
git commit -m "feat(<name>): ..."
```

## Remove a feature

1. Delete `packages/<name>`.
2. Remove its four lines from `packages/registry`: the import and the entry in `server.ts`, the import and the entry in `client.tsx`.
3. Remove the `"@jobyssey/<name>"` line from `packages/registry/package.json`. When it was the last entry in `dependencies`, also remove the trailing comma on the line above.
4. Run `pnpm install`, then `pnpm check`.
