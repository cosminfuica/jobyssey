# Modes: short instructions, typed tools, typed results

Every piece of AI work is a Mode, defined in its feature package as a short instructions file, a fixed set of typed tools and a typed result shape. One runner in the `llm` package executes a Mode on any LLM Provider or Harness (AI SDK tool calls for LLM Providers, `jobyssey` CLI subcommands for Harnesses, per ADR 0014; each tool is defined once and exposed both ways) and validates the result against the shape before anything is saved. Fixed tools and small instructions keep results predictable and token use low.

## Considered Options

- **SKILL.md folders**: native to agent CLIs, but API-key providers would need a separate loader and results would not be typed.
- **Large prompt files**: drift between languages and high token cost.
