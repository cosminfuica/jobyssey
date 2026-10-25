# Any Harness runs Modes; tools are a `jobyssey` CLI

Jobyssey can hand a Mode to any Harness installed on the Job Seeker's computer (Claude Code, Codex, OpenCode, Pi, Hermes and others). Each Harness is one config entry, a command template such as `claude -p {prompt}` or `opencode run {prompt}`, auto-detected on the PATH; people can add their own. A Mode's tools are subcommands of a `jobyssey` CLI that the Harness runs through its own shell. Each subcommand validates its input against the Mode's typed shape and sends it to the local API, scoped to the Run. The Harness keeps the Job Seeker's own settings, skills and tools, with no sandbox. Jobyssey never reads, stores or forwards a Harness's login credentials; it only runs the unmodified program the Job Seeker installed and logged into.

## Considered Options

- **MCP server**: most Harnesses support it, but each configures it differently, so Jobyssey would maintain a config per Harness; Codex also cannot approve MCP tool calls non-interactively yet (openai/codex#24135, open in October 2026).
- **JSON answer only**: works with every Harness, but a Mode cannot do multi-step work.
- **Locking the Harness down** (no built-in tools, no user settings, empty working directory): safer against instructions hidden in Job Posting text, but needs per-Harness flags, which breaks the Harness-agnostic design.

## Consequences

Job Posting text is untrusted input to a Harness that keeps its full tools. The `jobyssey` CLI only accepts writes for the current Run, but injected instructions can still use the Harness's own tools. This is an accepted risk for local installs.
