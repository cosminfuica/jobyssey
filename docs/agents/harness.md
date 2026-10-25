# Harness notes

How a coding agent that delegates work to other agents runs a task in this repo. These notes are about the agent harness, not the code: [AGENTS.md](../../AGENTS.md) is the map of the code and its checks.

## Orchestrator Contract

- Start by identifying the real user goal and the smallest observable result
  that satisfies it.
- Delegate independent search, implementation, and verification work to
  background agents when the task has separable parts.
- Keep direct edits focused on work that does not need specialist context.
- Verify worker results yourself before using them as evidence.

## Agent Selection Rules

- Use `explore` for fast codebase search, policy lookup, and path discovery.
- Use `librarian` for docs, external references, and examples from other repos.
- Use `architect` for architecture review, risk checks, and debugging analysis.
- Use a category task for execution work that needs file edits.
- Use `/ulw-plan` for plans that need user approval before implementation.

## Calling Conventions

- Give each delegated agent one goal, a clear deliverable, and exact paths or
  commands to inspect.
- Ask read-only agents for findings with file paths and evidence, not edits.
- Ask implementation agents to include the verification commands they ran.
- Retrieve background output before marking a delegated task complete.

## Instruction Phrasing

- Prefer affirmative constraints: "Keep scratch files under ./.omo/session-work/"
  instead of broad negative phrasing.
- State required artifacts directly: evidence files, screenshots, transcripts,
  command output, or PR links.
- Name the allowed work area when the task must avoid unrelated files.

## Workflow Loop

- Plan the work, then split independent tasks before starting edits.
- Run the cheapest useful failing check or missing-docs search before the fix.
- Apply the smallest change that satisfies the request.
- Run targeted checks and one real surface QA step.
- Summarize what changed, what passed, and any remaining risk.
