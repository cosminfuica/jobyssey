# docs

- `adr/`: architecture decisions, one file each; `adr/README.md` lists them.
- `guides/`: how to work in the repo.
  - `add-a-feature.md`: generate, edit and remove a feature package.
  - `migrations.md`: add tables, destructive changes, snapshots, the lock file.
  - `testing.md`: test projects, Postgres locally, where tests live.
  - `guards.md`: what each check catches and how to extend its lists.
  - `commits.md`, `pull-requests.md`, `labels.md`, `releasing.md`: commits, pull requests, labels and releases.
- `agents/`: notes for coding agents.
  - `domain.md`: the glossary and the ADRs.
  - `issue-tracker.md`, `triage-labels.md`: GitHub Issues and triage labels.
  - `harness.md`: how an orchestrating agent delegates and verifies work.

`ARCHITECTURE.md` at the repository root is the map of the code.
