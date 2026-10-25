# Conventional Commits, squash merges and release-please

Every commit follows Conventional Commits with a required scope: a workspace folder name or one of `repo`, `deps`, `docs`, `github` and `release`, with the trailers `Closes: #N`, `Refs: #N` and `Assisted-by: <tool> (<model>)` checked by commitlint. Pull requests merge by squash only, and the squash commit takes the PR title and body, so `main` reads as one Conventional Commit per change. release-please turns that history into `CHANGELOG.md`, `vX.Y.Z` tags and GitHub Releases, so nobody writes release notes by hand.

## Considered Options

- **Changesets**: one file per pull request, built for repos that publish many package versions.
- **git-cliff**: writes the changelog only, with no release pull request.
- **Free-form commits**: no changelog can be built from the history.
