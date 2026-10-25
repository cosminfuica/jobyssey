# Pull requests

## The flow

1. **Issue.** Open an issue, or find one, that describes the problem.
2. **Accepted label.** Wait until a maintainer labels the issue `ready-for-agent` or `ready-for-human` (see `docs/agents/triage-labels.md`). Work starts only then.
3. **Branch.** Make the change on a branch of your fork. Run `pnpm check` before pushing.
4. **Pull request template.** Fill every section of `.github/pull_request_template.md` in your own words and delete each `_Replace this line:` prompt.
5. **Gate.** The `pr-gate` check runs on every edit and push and posts one comment listing what to fix.
6. **Review.** A maintainer reviews once the gate and CI are green.
7. **Squash.** The pull request is squash-merged: the title becomes the commit header and the description becomes the commit body (see [commits.md](commits.md)).

## What the gate checks

The gate runs from the base branch (`.github/workflows/pr-gate.yml`, logic in `scripts/lib/pr-gate.ts`) and never runs code from the pull request. Pull requests from bots and release-please branches are exempt. Maintainers (owner, members, collaborators) skip the AI assistance section and the linked-issue check, and may write `none` under Linked issue.

| Message                                                                         | How to fix it                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section "## X" is missing.                                                      | Restore the heading from the template, spelled exactly, as a `##` heading.                                                                                                                                               |
| Section "## X" still holds the template prompt.                                 | Delete the `_Replace this line:` line and write the section yourself.                                                                                                                                                    |
| Section "## X" is empty or holds only filler.                                   | Write real content; `n/a`, `none`, `tbd`, `todo` and dashes do not count.                                                                                                                                                |
| Section "## How I tested" names no command.                                     | Put each command you ran in backticks, for example `pnpm check`, or in a fenced code block.                                                                                                                              |
| Section "## AI assistance": check exactly one box.                              | Check one of the two boxes, not both and not neither.                                                                                                                                                                    |
| You checked "AI tools were used" but the description has no "Assisted-by" line. | Add a line `Assisted-by: <tool> (<model>)`, for example `Assisted-by: Claude Code (claude-opus-4)`.                                                                                                                      |
| You checked "No AI tools were used" but the description has an "Assisted-by:".  | Remove the `Assisted-by:` line or check the other box.                                                                                                                                                                   |
| No linked issue.                                                                | End the description with `Closes: #<issue>` (the colon form). GitHub links only issues in this repository.                                                                                                               |
| Linked issue #N is not accepted.                                                | The issue must be open and labelled `ready-for-agent` or `ready-for-human`. The gate re-runs by itself when a maintainer adds the label.                                                                                 |
| First contributions are limited to 300 changed lines.                           | Split the work into smaller pull requests, each with its own accepted issue. `pnpm-lock.yaml` and `packages/db/migrations/meta/` do not count. A maintainer can add `size-ok` and re-run the gate.                       |
| The title and description fail commitlint.                                      | Title `type(scope): subject` (see [commits.md](commits.md)); contributors end the description with `Closes: #<issue>`; any `Closes:`, `Refs:` or `Assisted-by:` line must match its format. The step log names the rule. |

The gate also sets one `size/*` label (`size/XS` up to 10 changed lines, `size/S` up to 50, `size/M` up to 200, `size/L` up to 500, `size/XL` above) and the `gate-failed` label while anything is wrong. Pull requests that keep `gate-failed` for 7 days close automatically.

## Maintainer labels

- `size-ok`: lets a first contribution exceed 300 changed lines, for example a generated feature package. Re-run the `pr-gate` job after adding it; label changes do not trigger it.
- `slop`: closes the pull request with a canned reply that explains what was missing and how to resubmit (`.github/workflows/slop.yml`).

Only maintainers can add labels, so contributors cannot use either one.

## Dry run

`scripts/pr-gate.ts` reads a JSON file instead of the GitHub API when `PR_FIXTURE` is set. The file holds the GraphQL responses in request order (one per page of changed files):

```bash
GITHUB_OUTPUT=/tmp/out PR_FIXTURE=tests/fixtures/pr-gate/template-untouched.json node scripts/pr-gate.ts
```
