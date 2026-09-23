---
summary: Code is organized as a modular monolith by domain, with light clean architecture (framework-free services and pure domain rules), not full Clean Architecture.
read_when: Deciding where logic goes, or tempted to add layers/abstractions (interfaces, DI containers).
updated: 2026-09-22
---

# 0006. Modular monolith with light clean architecture

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
Three entry points (HTTP, WhatsApp agent, jobs) must share the same business rules. The project is small and maintained by one developer with Claude.

## Decision
- Organize by domain module (`modules/<domain>/`) in the API and by feature (`features/<name>/`) in the web, not by technical layer.
- Keep the core idea of clean architecture: dependencies point inward, services don't know about frameworks, and domain rules are pure functions in `packages/shared`.
- Skip the ceremony: no repository interfaces, no DI container, no entity classes. Services import their concrete repository.
- Services that grow split into vertical slices (`use-cases/`).

## Alternatives considered
- Layered (`controllers/`, `services/`, `models/`): a feature ends up spread across folders and coupling grows.
- Full Clean/Hexagonal Architecture: abstractions like swappable DB ports don't pay off at this size.
- Pure vertical slices with no modules: finance entities are too interrelated (cards ↔ transactions ↔ budgets).

## Consequences
- Boundaries are enforced by tooling (`../architecture/dependency-rules.md`), not by convention alone.
- Tests use a real Postgres instead of mocked repositories.
