---
summary: Phases, MVP scope, current focus and the list of open questions.
read_when: Deciding what to build next, checking whether something is in scope, or resuming work in a new session.
updated: 2026-09-22
---

# Roadmap

## Current focus
- [x] Stack and architecture defined (see `../decisions/`)
- [x] Docs skeleton written
- [x] Engineering process (git, PRs, CI/CD, skills) and observability designed
- [ ] User gives more context on the problem → business rules and DB model (**next conversation topic**)
- [ ] Answer the blocking open questions below (need the couple's input)
- [ ] Scaffold the monorepo (pnpm workspaces, `apps/api`, `apps/web`, `packages/shared`)
- [ ] Domain model and first migrations

## Phase 1: MVP
Goal: both partners record expenses through WhatsApp and see the month on the dashboard.

- Household setup: members, WhatsApp numbers, cards (closing/due day), accounts, categories
- Pure domain functions with tests: money, billing cycle, installments, competence
- Transactions: expense, income, refund; card installments
- Incomes: fixed salaries and commissions, with the budgeting policy
- Monthly budget per category
- WhatsApp agent (text only): record expense/income, query budget, invoice summary, undo last. Every write is confirmed.
- Dashboard: month overview, budget vs spent, open invoices, future installment commitments
- Deploy on Dokploy, with daily Postgres backup

## Phase 2
- Audio messages (transcription step; see `../integrations/ai-agent.md`)
- Receipt photos (Claude vision)
- Recurring bills generated automatically
- Daily/weekly WhatsApp digest
- Commission waterfall automation

## Phase 3
- Statement and invoice import (OFX/CSV/PDF) with reconciliation against recorded transactions
- Goals and emergency reserve tracking
- Reports: month over month, category trends

## Open questions
Blocking for the domain model:
1. Installments and budget: does a 10× purchase count fully in the purchase month, or one installment per invoice month? (`../domain/billing-and-installments.md`)
2. Cards: list, holders, closing and due days; how each bank handles a purchase made on the closing day.
3. Pay days for salaries; timing of commissions.

Non-blocking:
4. Category list: existing or new?
5. Transcription for audio: local whisper.cpp vs external API.
6. Model for the agent: default `claude-opus-5`; whether to test cheaper models once real message samples exist.
7. Alert channel (ntfy, Telegram, email). Must not be WhatsApp.
8. Remote access to the dashboard and deploy trigger (Tailscale vs Cloudflare Tunnel), see `../operations/deploy.md`.
9. Offsite backup destination.
