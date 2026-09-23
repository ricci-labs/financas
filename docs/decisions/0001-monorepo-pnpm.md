---
summary: One repo with pnpm workspaces (apps/api, apps/web, packages/shared); Turborepo deferred.
read_when: Changing repo layout, build tooling or package boundaries.
updated: 2026-09-22
---

# 0001. pnpm workspaces monorepo, no Turborepo yet

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The API, the web app and the agent share Zod schemas and pure domain rules (billing cycle, installments). Hono RPC needs the web to import the API's types.

## Decision
One repository, pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`. Scripts run with `pnpm -r` / `pnpm --filter`.

## Alternatives considered
- Separate repos: shared code would need publishing or copying, and RPC types would break.
- Turborepo/Nx now: task caching and orchestration pay off with many packages. With three, they're overhead.

## Consequences
- A schema change surfaces type errors in all three packages at once.
- If builds get slow, add Turborepo. It sits on top of pnpm workspaces without restructuring.
