# scripts

The repository commands behind the root `package.json` scripts. Node runs
them directly (`node scripts/<name>.ts`). This folder is not a workspace
package: check-workspace and dependency-cruiser never see it, while oxlint,
the root `tsconfig.json`, ls-lint and knip do. `pnpm test:root` runs its
tests; `pnpm test` does not.

## Where to look

| File                                   | Run by                          | Notes                                                                                                |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `check-workspace.ts`                   | `pnpm check:workspace`          | CW01-CW18; each rule's `// CWnn` comment names its false positives. Exit 1 on problems, 2 on a crash |
| `check-migrations.ts`                  | `pnpm check:migrations`         | `node scripts/check-migrations.ts <folder>` checks another migration set                             |
| `gen-feature.ts`, `lib/feature-gen.ts` | `pnpm gen:feature <name>`       | Copies `packages/system` and registers the copy (`docs/guides/add-a-feature.md`)                     |
| `shadcn-add.ts`                        | `pnpm ui:add <name>`            | Runs the shadcn CLI in a scratch project, because the CLI needs tsconfig `paths`                     |
| `smoke.ts`                             | `pnpm smoke`                    | Needs `apps/web/dist`; expects PGlite, so unset `DATABASE_URL`, which the child process inherits     |
| `pr-gate.ts`, `lib/pr-gate.ts`         | `.github/workflows/pr-gate.yml` | Runs from the base branch, so a pull request that edits the gate is checked by the old one           |
| `lib/workspace.ts`                     | imported                        | `FIXED_SCOPES` and the workspace globs; `commitlint.config.ts` imports it too                        |
| `github/`                              | the owner, by hand              | `github/README.md`; agents and CI never run `apply-repo-settings.sh`                                 |

`docs/guides/pull-requests.md` (Dry run) shows how to run the gate locally on
a recorded pull request.

## Conventions

- A tested script keeps its logic in exported functions and runs its command
  line only under `if (import.meta.main)`, so the `*.test.ts` beside it
  imports it without side effects; `gen-feature.ts` and `pr-gate.ts` keep
  their logic in `lib/` instead.
- The checks print one `<location>: <message>` line per problem and set
  `process.exitCode` instead of calling `process.exit`.
- A test that needs a throwaway workspace creates it with
  `mkdtempSync(join(tmpdir(), "jby-..."))` and deletes it in `afterEach`. The
  slow ones set a per-test `timeout` (`TIMEOUT = 30_000` in
  `check-workspace.test.ts` and `lib/feature-gen.test.ts`).
- A new CW rule gets a row in `cases` in `check-workspace.test.ts`: a mutation
  of the valid fixture that produces exactly one problem.

## Rules

- Text added to `packages/system` must survive `renameFeature` in
  `lib/feature-gen.ts`: a leftover `system` stops the generator and deletes
  the copy (`docs/guides/add-a-feature.md` lists the renamed forms).
- CI's `gen-feature` job fails unless `pnpm gen:feature` changes only the
  three `packages/registry` files, the new package and `pnpm-lock.yaml`.
- CW17's exemptions change together with the `no-restricted-properties`
  exemptions in `oxlint.config.ts`.
- An edit to `.github/pull_request_template.md` also needs `REQUIRED_SECTIONS`
  and `PROMPT` in `lib/pr-gate.ts` checked, and the `template-untouched`
  fixture in `tests/fixtures/pr-gate/` updated: `lib/pr-gate.test.ts` requires
  it to equal the template.
