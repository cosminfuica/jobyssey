# Domain Docs

This repo uses a single-context layout: `GLOSSARY.md` at the repo root and `docs/adr/` for architectural decisions.

## Before exploring

- Read `GLOSSARY.md` at the repo root.
- Read ADRs in `docs/adr/` that touch the area you are about to work in.

If these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill, reached via `/grill-with-docs` and `/improve-codebase-architecture`, creates them lazily when terms or decisions are resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, or a test name), use the term defined in `GLOSSARY.md`. Avoid synonyms the glossary explicitly rejects.

If a concept is missing, reconsider whether it belongs to the project's vocabulary or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, explicitly identify the ADR and explain why the decision is worth reopening instead of silently overriding it.
