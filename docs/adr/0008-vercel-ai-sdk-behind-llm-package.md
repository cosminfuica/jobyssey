# Vercel AI SDK behind one `llm` package

All LLM calls go through one `llm` package built on the Vercel AI SDK, and the LLM Provider (OpenAI, Anthropic, Google, OpenRouter, or any OpenAI-compatible endpoint such as Ollama) is chosen by config. The AI SDK already ships per-vendor adapters, streaming, tool calls and structured output, so Jobyssey writes no vendor adapters of its own. Features depend on the `llm` package, never on the AI SDK directly, so the SDK stays swappable. Harnesses (ADR 0014) do not go through the AI SDK: the same package runs them from their command templates.

## Considered Options

- **Vendor SDKs**: one adapter per vendor to write and maintain.
- **LangChain**: a large framework with heavy abstractions that change often.
