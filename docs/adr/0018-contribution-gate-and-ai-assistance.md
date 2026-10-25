# Contribution gate and AI assistance

Outside contributors open an issue first and fill in every mandatory section of the PR template; maintainers' pull requests skip the AI-assistance section and may write `none` under Linked issue. AI assistance is allowed on contributor pull requests if it's disclosed with an `Assisted-by:` trailer and the template checkbox; maintainers' direct commits carry no trailer, because the project states it's built with AI tools. The author must be able to explain the change and must have run it, no autonomous agent may open a pull request, and a first contribution has a size cap. A pull request labeled `slop` closes with a canned reply, and one that fails the gate closes after 7 days.

## Considered Options

- **A hard ban on AI contributions**: inconsistent with how the project is built, and nobody can verify it.
- **Pull requests from collaborators only**: no outside code at all; kept as a documented switch.
- **Disclosure only**: nothing gates quality.

## Consequences

The gate runs from the base branch and never executes code from the pull request.
