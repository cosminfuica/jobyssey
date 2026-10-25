# Labels

Every label the repository uses. `scripts/github/labels.json` creates them, and a test checks that it matches this list. Each bullet starts with the label name in backticks.

## Triage

Issues move through these. `docs/agents/triage-labels.md` maps them to the roles agent skills use.

- `needs-triage`: a maintainer still has to evaluate the issue.
- `needs-info`: waiting on the reporter for more information.
- `ready-for-agent`: fully specified, ready for an agent to pick up.
- `ready-for-human`: accepted, needs a human to implement it.
- `wontfix`: won't be acted on.

## Gate

The pull request gate and maintainers set these (see `docs/guides/pull-requests.md`).

- `gate-failed`: the pull request gate found something to fix. Closes automatically after 7 days.
- `size-ok`: a maintainer lets a first contribution exceed 300 changed lines.
- `slop`: a maintainer closed the pull request as low effort.

## Size

The gate sets exactly one, from the number of changed lines.

- `size/XS`: up to 10 changed lines.
- `size/S`: up to 50 changed lines.
- `size/M`: up to 200 changed lines.
- `size/L`: up to 500 changed lines.
- `size/XL`: more than 500 changed lines.

## Area

The labeler workflow sets these from the changed paths (`.github/labeler.yml`).

- `area:apps`: changes under `apps/`.
- `area:packages`: changes under `packages/`.
- `area:tooling`: changes under `tooling/`.
- `area:scripts`: changes under `scripts/`.
- `area:docs`: changes under `docs/` or any Markdown file at the root or directly in `.github/`.
- `area:github`: changes under `.github/`.

## GitHub defaults kept

- `bug`: something doesn't work.
- `enhancement`: a new feature or a change to how one works.
- `documentation`: docs only.
- `good first issue`: a good start for a new contributor.
- `help wanted`: a maintainer would welcome a pull request.
- `duplicate`: already reported elsewhere.
- `invalid`: not a valid report.
- `question`: a question, better asked in Discussions.
