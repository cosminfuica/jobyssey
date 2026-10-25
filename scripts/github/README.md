# Repository settings

Settings that live on GitHub rather than in git, kept here as code so they can be reviewed and re-applied.

| File                     | What it is                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `apply-repo-settings.sh` | The script the owner runs. `--dry-run` prints every write call and runs none.                             |
| `labels.json`            | Every label (`name`, `color`, `description`). `labels.test.ts` checks it matches `docs/guides/labels.md`. |
| `rulesets/main.json`     | The ruleset for `main`.                                                                                   |

## Go live

The owner does these in order. Nothing here is automated, and the script is never run by an agent or CI.

1. Review `main` locally.
2. `git push --force-with-lease origin main`. The new history replaces the old one. The old `develop` and `main` tips are recorded in `.omo/evidence/workspace-setup/task-1-baseline.txt` and in the local archive branch, which is never pushed.
3. Run `scripts/github/apply-repo-settings.sh`. It sets the default branch to `main` first, so step 4 is allowed.
4. `git push origin --delete develop`.
5. Create the `RELEASE_PLEASE_TOKEN` secret, link the repository at https://cla-assistant.io, and install the Renovate app. The script prints these three as its last step.
6. Open one trivial pull request. Confirm that the `pr-gate`, `ci-summary` and `license/cla` checks appear, then add any the script could not add to the ruleset (a private repository on a free plan cannot have one).
7. When the repository goes public, run the script again for the settings that need a public repository.

Never amend or rewrite a commit on `main` once it has been pushed or pinned by another workspace.

## What the script changes

1. Repository: default branch `main`, squash merges only with the pull request title and body as the commit message, branches deleted after merge, "Update branch" button on, Discussions on, wiki and projects off.
2. Private vulnerability reporting on. Public repositories only.
3. Dependency vulnerability alerts on.
4. Labels from `labels.json`, created or updated in place.
5. The `main` ruleset from `rulesets/main.json`: no deletion, no force push, linear history, pull requests with squash merges and resolved review threads, and the checks `ci-summary`, `pr-gate` and `license/cla` up to date with `main`. Repository admins bypass it (`actor_id` 5 is the Admin role). It is updated when a ruleset named `main` exists and created otherwise. A private repository without a paid plan gets a `skipped` line instead.
6. Fork pull request workflows need approval for all external contributors. Public repositories only.
7. It prints the steps no API covers (Renovate, cla-assistant.io, the release token).

It never changes `pull_request_creation_policy`. The command to accept pull requests from collaborators only is printed as a comment in step 7.

## Run it again safely

Every call sets a value, so running the script twice leaves the same result. Start with `--dry-run`: it prints the write calls and runs only the read-only request that decides between updating and creating the ruleset. It needs `gh` (logged in with admin rights on the repository) and `node`. It stores no tokens.

## When a second maintainer joins

The ruleset sets `require_code_owner_review` to `false` because a solo maintainer cannot approve their own pull requests. `.github/CODEOWNERS` still requests review automatically. Set `require_code_owner_review` to `true` in `rulesets/main.json` and run the script again.
