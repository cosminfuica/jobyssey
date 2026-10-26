# Contributing to Jobyssey

Thanks for wanting to help. This guide covers how work starts, how to set up, what a pull request needs and the rules for AI assistance.

## Before you start

Work starts from an issue. Open one, or find one that describes the problem, and wait until a maintainer labels it `ready-for-agent` or `ready-for-human`. Pull requests without an accepted issue fail the gate. Small fixes to docs are welcome without an issue only from maintainers.

## Setup

You need Node 26 (from `.nvmrc`) and pnpm 12; the [README](README.md#requirements) explains how to install them.

```bash
git clone <your fork's URL>
pnpm install
pnpm dev
pnpm check
```

`pnpm dev` runs the API on http://127.0.0.1:4180 and the web app with reload. `pnpm check` runs the guards, typechecks, lint and tests, and must exit 0 before you push.

The development commands use Turborepo, which collects anonymous usage data. Switch it off with `pnpm exec turbo telemetry disable`.

## Making changes

- One issue per pull request.
- New features start from `pnpm gen:feature <name>`, which creates and registers the package (see [docs/guides/add-a-feature.md](docs/guides/add-a-feature.md)).
- Tests live in each package's `tests/` folder and import the package through its entry points, never its internal files (see [docs/guides/testing.md](docs/guides/testing.md)).
- Schema changes get a migration from `pnpm db:generate`. Never edit a migration that has been applied. A destructive change is split into expand and contract migrations, and only the contract migration carries the `-- expand-contract: ok` marker (see [docs/guides/migrations.md](docs/guides/migrations.md)).
- Prettier, oxlint and the workspace guards enforce the code style. Run `pnpm check`; [docs/guides/guards.md](docs/guides/guards.md) explains each message.
- In VS Code, lint errors show through the oxc extension (`oxc.oxc-vscode`), and TypeScript 7 errors through the "TypeScript 7" extension (`TypeScriptTeam.native-preview`) once you turn it on with the `TypeScript: Enable TypeScript 7` command or the `js/ts.experimental.useTsgo` setting.
- Dependency licences: permissive licences (MIT, BSD, ISC, Apache-2.0) and MPL-2.0 are fine. AGPL, SSPL and GPL are not allowed in runtime dependencies.

## Commits

Commits follow Conventional Commits with a required scope; [docs/guides/commits.md](docs/guides/commits.md) has the format and the trailers. The `commit-msg` hook lints every message.

## Pull requests

[docs/guides/pull-requests.md](docs/guides/pull-requests.md) describes the whole flow. In short:

- Fill every section of the pull request template in your own words.
- End the description with `Closes: #N`, where N is the accepted issue.
- Keep a first contribution under 300 changed lines.
- The `pr-gate` check runs on every edit and push and posts one comment that lists what to fix. The pull request gets the `gate-failed` label while anything is wrong, and a pull request that keeps `gate-failed` for 7 days closes. The guide explains each message.

## AI assistance policy

You may use AI tools. These rules apply when you do:

- **Disclose it.** Check the "AI tools were used" box in the pull request template and add a line `Assisted-by: <tool> (<model>)`, for example `Assisted-by: Claude Code (claude-opus-4)`. The maintainer's own commits carry no trailer, because this whole project is built with AI tools, under the same review rules.
- **Understand it.** You must be able to explain every changed line.
- **Run it.** Run `pnpm check` and the change itself, in the browser or with curl, before you open the pull request.
- **Stay in charge.** Don't let an agent open issues or pull requests on its own. Don't submit AI-written issues, reviews or comments.
- **Expect low-effort work to close.** Maintainers label low-effort pull requests `slop` and close them with a short note. Repeated slop leads to a block.

Why: reviewer time is the scarce resource. A contribution should be worth more to the project than the time it takes to review it, and that holds whether a person or a tool wrote it.

## Contributor License Agreement

On your first pull request, the CLA Assistant bot asks you to sign [CLA.md](.github/CLA.md). You sign once, and it covers your later pull requests.

## Code of conduct

Everyone in the project follows the [Code of Conduct](.github/CODE_OF_CONDUCT.md).

## Security

Don't report vulnerabilities in public issues. Follow [SECURITY.md](.github/SECURITY.md) instead.
