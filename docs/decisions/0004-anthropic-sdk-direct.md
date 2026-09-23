---
summary: The agent uses @anthropic-ai/sdk (Tool Runner) directly; no agent framework like Mastra or LangChain.
read_when: Changing the agent loop, or considering an agent framework.
updated: 2026-09-22
---

# 0004. Anthropic SDK directly, no agent framework

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The agent is small: a handful of tools, short conversations, one provider. Misread expenses must be easy to debug.

## Decision
Use `@anthropic-ai/sdk` with its Tool Runner (Zod tools). Memory, pending actions and cost tracking are ours, in Postgres.

## Alternatives considered
- Mastra: offers memory, workflows and a playground. Its runtime RAM cost is modest; the real costs are a large dependency tree, a provider-agnostic layer we don't need, API churn, and a hidden loop that makes debugging harder.
- LangChain: same trade-off, heavier.

## Consequences
- The loop stays visible and small. Adding a tool means adding one file.
- We implement memory and confirmation ourselves (a few hundred lines).
- Load the `claude-api` skill before writing SDK code, because APIs drift.
