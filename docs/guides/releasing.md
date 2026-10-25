# Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please). Nobody edits `CHANGELOG.md` or the version by hand.

## How a release happens

1. A pull request is squash-merged to `main`.
2. The `release` workflow (`.github/workflows/release.yml`) opens or updates one release pull request titled `chore(release): release X.Y.Z`. Its `CHANGELOG.md` section is generated from the [Conventional Commit](./commits.md) subjects merged since the last release.
3. When a maintainer merges the release pull request, release-please tags `vX.Y.Z` and publishes a GitHub Release with the same notes.

Only `feat`, `fix`, `perf` and `revert` commits show up in the changelog; `docs`, `refactor`, `build`, `ci` and `chore` commits are hidden from it.

The app shows its version from the `version` field of the root `package.json`, which release-please bumps in the release pull request.

## Token setup (owner step)

The workflow needs a repository secret named `RELEASE_PLEASE_TOKEN`. A personal access token is required because pull requests opened with the default `GITHUB_TOKEN` trigger no checks, so the release pull request would never run CI.

1. Create a fine-grained personal access token limited to this repository with `Contents` and `Pull requests` set to read and write.
2. Set its expiry to at most one year.
3. Save it as the repository secret `RELEASE_PLEASE_TOKEN`.
4. Write the expiry date below and set a reminder to rotate the token before then.

Expires: `<set when the token is created>`

While the secret is missing, the workflow skips the release step with a notice (`RELEASE_PLEASE_TOKEN is not set; skipping release`) and `main` stays green. When the token expires, release-please fails until a new one is saved.

## Versions below 1.0

The version stays `0.x` until the first stable release. In `.github/release-please-config.json`, `bump-minor-pre-major` and `bump-patch-for-minor-pre-major` make breaking changes bump the minor version and features bump the patch version, so the first release is `0.0.1`.

To jump to `0.1.0` or `1.0.0`, add `"release-as": "0.1.0"` (or `"1.0.0"`) to the `.` package in `.github/release-please-config.json` once, merge it, and remove the line after that release.

## Hotfixes

There are no release branches. Merge the fix commit to `main`; it lands in the next release pull request. Merge that pull request when the fix should ship.

## Release pull requests and the contribution gate

Release pull requests are exempt from the contribution gate. The gate recognises them by their `release-please--` head branch.
