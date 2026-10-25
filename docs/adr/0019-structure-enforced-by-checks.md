# Every structure rule is enforced by a check

Each documented layout rule has a mechanical enforcer, and docs point at the enforcer instead of restating the rule. Prose rules drift and nobody, human or agent, reads all of them, while a failing check names the exact file to fix.

| Rule                                                                                | Check                   |
| ----------------------------------------------------------------------------------- | ----------------------- |
| Package manifests, `tsconfig.json`, README and `exports` follow the workspace shape | `pnpm check:workspace`  |
| File and folder names follow the layout                                             | `pnpm lint:files`       |
| Dependency versions agree across packages                                           | `pnpm lint:deps`        |
| No unused files, exports or dependencies                                            | `pnpm lint:unused`      |
| Features meet only through entry points; browser and server code stay apart         | `pnpm lint:boundaries`  |
| Migrations stay in order and destructive SQL is marked                              | `pnpm check:migrations` |

## Confirmation

`pnpm check:workspace`, `pnpm lint:files`, `pnpm lint:deps`, `pnpm lint:unused`, `pnpm lint:boundaries` and `pnpm check:migrations` all exit 0 on `main`.
