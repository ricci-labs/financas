# financas

Multi-tenant personal finance app, starting with a couple who pool their income. Two channels:
a web dashboard and a WhatsApp agent (Claude) that records expenses, charges third parties and answers questions.
Self-hosted on a small headless Debian homelab, deployed with Dokploy.

**Status:** pre-scaffold. Only `docs/` exists. See `docs/product/roadmap.md` → "Current focus".

## Talking to the user
- Reply in Brazilian Portuguese. Code, identifiers, commits and docs are in English.
- Portuguese domain terms map to code names in `docs/domain/glossary.md`. Check it before naming anything.

## Before you work
1. Read `docs/README.md`. It is a routing table: open only the docs your task needs.
2. For anything about money, invoices, installments or dates, read `docs/domain/billing-and-installments.md` first.
3. Before a structural choice, check `docs/decisions/`. Don't reopen an accepted ADR without the user.

## Hard rules
- **This repo is public.** Never commit real household data: amounts, incomes, bank or card names, people's names, phone numbers, addresses, screenshots with real data, `.env` values. Docs and tests use generic placeholders ("Member A", "Card X", round amounts). Real data lives only in the production database, or in gitignored files under `.private/`.
- **Multi-tenant:** every tenant query runs through `core/db/tx.ts` with the workspace set (RLS). Tenant tables use composite FKs on `(workspace_id, id)` (`docs/domain/model/README.md`).
- **Double-entry ledger:** money moves only as balanced journal entries. Postings are immutable; edits replace the entry, and deletes are soft (`docs/domain/model/ledger.md`).
- **Soft delete everywhere** (`deleted_at`); repositories filter it by default. Hard delete only for LGPD workspace erasure.
- **Every route and agent tool declares its `(module, action)` permission** (`docs/domain/model/access-control.md`).
- Money is an **integer number of cents** (`amountCents`). Never floats, never `numeric` → JS number.
- Business rules live in pure functions (`packages/shared/src/domain`) and module services. Routes, the WhatsApp channel, the agent and jobs call services and hold no business logic.
- **The LLM never touches the database.** It only calls tools, and each tool calls one service. Every write goes through a confirmation step (`docs/integrations/ai-agent.md`).
- Modules talk to each other only through their `index.ts`. Only the owning service imports a repository. Full list: `docs/architecture/dependency-rules.md`.
- Dates follow `America/Sao_Paulo`. Take "now" from `core/clock.ts`, never `new Date()` inside business logic.
- The server has ~5 GB free RAM and 4 cores. Add no new process, container or heavy dependency without asking.

## Workflow
- Git, commits and PRs: `docs/engineering/git-workflow.md` (Conventional Commits, branch → PR → squash merge). Commit, push or open PRs only when the user asks.
- If a project skill in `.claude/skills/` matches the task, use it (`docs/engineering/claude-workflow.md`).
- **Bug, error ref (`ref: xxxxxxxx`), alert or "not working":** follow `docs/operations/runbook.md` before reading code.
- Log through the module's child logger with a catalog `event` name. Never `console.log` (`docs/operations/observability.md`).

## Keeping docs current
- A change to behavior, rules or structure goes in the same change as the matching doc update. Bump `updated:` in its frontmatter.
- A new architectural decision gets an ADR (`docs/decisions/README.md` has the template).
- Docs hold intent, rules and the "why". Code is the source of truth for everything else, so don't paste large code into docs.

## Commands
_To be defined when the monorepo is scaffolded (pnpm workspaces)._
