---
summary: Source code has no comments and must read like well-written prose (self-documenting code, Clean Code practices); style is enforced by Biome and a no-comments check; imports use per-package @ aliases.
read_when: Writing or reviewing any code, or tempted to add a comment.
updated: 2026-09-23
---

# 0017. Self-documenting code, no comments, @ aliases

- **Status:** Accepted
- **Date:** 2026-09-23

## Context
The user wants code that is highly standardized and easy for humans to read, "as if a person wrote it", following best practices, with no comments, and imports that use `@` aliases instead of relative paths.

## Decision
- **No comments in source code.** Intent is carried by names, small functions and structure. The "why" lives in the docs and ADRs. The only exceptions are tool directives (`biome-ignore`, `@ts-expect-error`), each with a reason in the directive itself. Enforced by `scripts/check-no-comments.mjs` (pre-commit and CI).
- **Readability rules** (`../architecture/conventions.md` → Code style), enforced by Biome where possible: no nested ternaries, block statements always, bounded cognitive complexity, no parameter reassignment, no non-null assertions, named exports only, kebab-case file names.
- **Per-package `@` aliases**: `@api/*`, `@web/*`, `@shared/*`, declared once in `tsconfig.base.json`. Each package has its own prefix because a shared `@/` would resolve to the wrong package when the web type-checks the API's types (Hono RPC).
- Because Node can't resolve `@` aliases natively, the API runs with `tsx` in development and is bundled with `tsdown` for production. Vite and Vitest resolve the aliases with `resolve.tsconfigPaths`.

## Alternatives considered
- Comments allowed "for the why": the user explicitly doesn't want them, and the docs + ADRs already hold the why.
- A single `@/` alias per package: breaks cross-package type resolution for the RPC client.
- Node native TypeScript with `#` subpath imports: no build step, but `#` isn't the `@` the user asked for.

## Consequences
- Code reviews focus on naming. If code needs a comment to be understood, it gets renamed or split.
- The API has a build step (tsdown) and a dev runner (tsx).
- dependency-cruiser reads TypeScript through SWC until it supports the TypeScript 7 API.
