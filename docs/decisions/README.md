---
summary: Index of Architecture Decision Records (ADRs) and the template for new ones.
read_when: Checking why something was chosen, before proposing to change a past choice, or when recording a new decision.
updated: 2026-09-25
---

# Decisions (ADRs)

| # | Decision | Status |
|---|---|---|
| 0001 | [pnpm workspaces monorepo, no Turborepo yet](0001-monorepo-pnpm.md) | Accepted |
| 0002 | [Hono as the HTTP framework](0002-hono.md) | Accepted |
| 0003 | [Baileys directly for WhatsApp](0003-baileys-direct.md) | Accepted |
| 0004 | [Anthropic SDK directly, no agent framework](0004-anthropic-sdk-direct.md) | Accepted |
| 0005 | [Vite + React SPA with Tailwind v4 and shadcn/ui](0005-spa-vite-react.md) | Accepted |
| 0006 | [Modular monolith with light clean architecture](0006-modular-monolith.md) | Accepted |
| 0007 | [Money as integer cents](0007-money-integer-cents.md) | Accepted |
| 0008 | [English for code and docs, pt-BR for UI](0008-language.md) | Accepted |
| 0009 | [Trunk-based development, PRs, squash merge](0009-trunk-based-squash-merge.md) | Accepted |
| 0010 | [Build in Actions → GHCR → Dokploy](0010-deploy-ghcr-dokploy.md) | Accepted |
| 0011 | [OpenTelemetry-ready observability on existing tools](0011-observability-otel-ready.md) | Accepted |
| 0012 | [Multi-tenant from day one (workspaces)](0012-multi-tenancy.md) | Accepted |
| 0013 | [Double-entry ledger](0013-double-entry-ledger.md) | Accepted (correction policy amended by 0016) |
| 0014 | [Enums vs configuration tables; typed settings](0014-enums-vs-config-tables.md) | Accepted |
| 0015 | [Module × action permissions with custom roles](0015-module-permissions.md) | Accepted |
| 0016 | [Soft delete everywhere; entry edits by replacement](0016-soft-delete.md) | Accepted |
| 0017 | [Self-documenting code, no comments, @ aliases](0017-self-documenting-code.md) | Accepted |
| 0018 | [Database roles and RLS enforcement](0018-database-roles-and-rls.md) | Accepted |
| 0019 | [Narrow SECURITY DEFINER lookups for pre-workspace flows](0019-narrow-security-definer-lookups.md) | Accepted |
| 0020 | [Invariant triggers run as the owner](0020-invariant-triggers-run-as-owner.md) | Accepted |
| 0021 | [Password login with server-side sessions](0021-password-login-with-server-sessions.md) | Accepted |
| 0022 | [Email via Nodemailer over SMTP](0022-email-via-nodemailer-smtp.md) | Accepted |
| 0023 | [Instance configuration from the environment](0023-instance-configuration-from-env.md) | Accepted |

## Rules
- ADRs are append-only. To change a decision, write a new ADR that supersedes the old one and set the old one to `Superseded by NNNN`.
- Keep them short. The "Consequences" section matters most.

## Template

```markdown
---
summary: <one line>
read_when: <trigger>
updated: YYYY-MM-DD
---

# NNNN. <Title>

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context
<the forces at play, constraints>

## Decision
<what we do>

## Alternatives considered
- <option>: <why not>

## Consequences
- <what gets easier, what gets harder, what we must now do>
```
