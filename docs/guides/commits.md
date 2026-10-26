# Commits

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/). commitlint enforces the convention: the `commit-msg` hook lints each local commit, and CI lints pull request titles and squash messages with the same config (`commitlint.pr.config.ts`).

## Format

```text
type(scope): subject

Body: why the change is needed.

Closes: #12
```

- **type**: one of `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.
- **scope**: required. Either a workspace folder name (the last segment of each folder matched by `pnpm-workspace.yaml` that has a `package.json`, for example `oxlint-config`) or one of the fixed scopes `repo`, `deps`, `docs`, `github`, `release`. The list is derived from the tree, so a new package becomes a scope as soon as it exists.
- **subject**: imperative mood, lower-case, no trailing period. The whole header is at most 72 characters.
- **body**: the why, not the what; the diff already shows the what. Separate it from the header with a blank line.

## Trailers

Trailers go at the end, after a blank line, one per line:

| Trailer                         | Format                                                                                           | When                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `Closes: #N`                    | one issue number                                                                                 | Required on pull request squash commits from non-maintainers; the issue comes first. |
| `Refs: #N`                      | one or more issue numbers, `Refs: #1, #2`                                                        | Optional; points at related issues without closing them.                             |
| `Assisted-by: <tool> (<model>)` | tool name, then the model in parentheses, for example `Assisted-by: Claude Code (claude-opus-4)` | Required on contributor pull requests that used AI tools.                            |

Maintainers' direct commits do not carry `Assisted-by`: the project is built with AI tools and CONTRIBUTING says so, so the trailer would carry no information there.

A line that starts with one of these keys but does not match its format fails the `trailer-format` rule.

## Merging

Pull requests are squash-merged. The pull request title becomes the commit header and the pull request body becomes the commit body, so both follow the format above; CI lints them before merge.

## Release notes

Release notes are generated from these commit subjects, so write each subject as a line a user of the project can read.
