---
summary: Phases, MVP scope, current focus and the list of open questions.
read_when: Deciding what to build next, checking whether something is in scope, or resuming work in a new session.
updated: 2026-09-26
---

# Roadmap

## Current focus
- [x] Stack and architecture defined (see `../decisions/`)
- [x] Docs skeleton written
- [x] Engineering process (git, PRs, CI/CD, skills) and observability designed
- [x] Problem deep-dive with the user; data model proposed (`../domain/model/`)
- [x] User reviews the data model (approved area by area with each PR series)
- [x] Scaffold the monorepo (pnpm workspaces, `apps/api`, `apps/web`, `packages/shared`), CI, quality gates
- [x] Domain functions with tests: money, installments + multi-party allocation, billing cycle, financial period
- [x] DB foundation: Postgres 18, owner/app roles, Drizzle migrations, `users` + `workspaces` with RLS, isolation tests in CI
- [x] DB: access control (`module_actions`, `roles`, `role_permissions`)
- [x] DB: memberships (owner invariant) + workspace creation service
- [x] DB: settings and preferences (`workspace_settings`, `user_preferences`, `membership_preferences`)
- [x] DB: invitations (create + accept flow)
- [x] Review of the tenancy/access base (3 bugs fixed: #13, #14, #15; model alignment: #16, #17)
- [x] `onboarding` module for flows spanning modules (#18)
- [x] DB: ledger accounts (tree, system accounts)
- [x] DB: journal entries + postings (balanced, immutable, soft delete)
- [x] Ledger services: postings planner + record / change / delete / restore / replace entry
- [x] Ledger account services: create / change / archive / delete / restore
- [x] DB: cards and invoices (tables, card creation, invoice rules)
- [x] Card purchases in installments, invoice payment
- [x] Purchases already in progress: record only the remaining installments
- [x] DB: balance views (`account_balances`, `invoice_totals`)
- [x] **Ledger series done** (#19–#27): accounts, entries, cards, installments, invoices, balances
- [ ] **HTTP API + web auth** (chosen 2026-09-25; password login, ADR 0021). Small PRs, in order:
  1. [x] ADRs 0021 (auth) and 0022 (email), and this plan
  2. [x] `identity`: `sessions` and `auth_tokens` tables, password hashing (scrypt)
  3. [x] `identity`: create user, login, resolve session, logout services
  3b. [x] `ops:create-user` script (first user + first workspace, password typed without echo)
  4. [x] Email: `core/email` `Mailer` with Nodemailer (ADR 0022), `.eml` outbox in development
  5. [x] `identity`: sign-up (behind `PUBLIC_SIGNUP_ENABLED`), email verification
  5b. [x] `identity`: forgot password and reset by email
  6. [x] HTTP core: error handler (`AppError` → status, error ref), request id, request logger
  7. [x] Auth routes: login, logout, me, config; session required by default; same-origin writes
  7b. [x] Login rate limit (per email and per client IP)
  7c. [x] Routes that send account emails: sign-up, verification resend, forgot password (202, limits)
  7d. [x] Routes that use the links: verify email, reset password (with limits on failed links)
  8. [x] `authorize(module, action)` middleware + workspace routes (`/api/workspaces/:workspaceId/...`)
     and a test that fails when a route has no permission
  8b. [x] `GET /api/workspaces`: the caller's workspaces (narrow SECURITY DEFINER lookup, ADR 0019)
  9. [x] Ledger routes: accounts
  9b. [x] Ledger routes: cards and invoices
  9c. [x] Ledger routes: entries
  9d. [x] Ledger routes: balances
  10. [x] Invitation routes: create (email or link to share), list pending, revoke; owner-only owner invites
  10b. [ ] Invitation routes: preview, accept (email must match), accept with sign-up
- Later options, in the order proposed: contacts and charges, planning, deploy on the homelab.
- [ ] DB: contacts/charges, planning, support tables
- [ ] Observability core (OTel register, metrics, error refs), Dockerfile, deploy workflow
- [ ] Web foundation: TanStack Router/Query, shadcn/ui, layout
- [ ] Remaining project skills (`new-module`, `db-migration`, `domain-rule`, `pr`) and Claude Code hooks

## Phase 1: MVP
Goal: the couple records everything through WhatsApp and the web, and always knows how much is still free to spend.

- Auth, workspaces, memberships, invitations, settings (financial period, budget view, reminders)
- Ledger: accounts, cash, cards, categories, opening balances; entries with reversal
- Cards: invoices, installments, invoice payment
- Contacts: shared purchases (several contacts, installments), charges sent over WhatsApp, settlements
- Planning: recurring bills and incomes, planned occurrences with matching, budgets, reserve goal
- Reminders: bills, invoices, charges (outbox)
- Attachments on entries (web upload + WhatsApp photo)
- WhatsApp agent (text): expenses, incomes, transfers, settlements, charges, overview, undo; always confirmed
- Dashboard: period overview (fixed income, spent, committed, free to spend), invoices (own vs others), contacts, upcoming bills
- Deploy on Dokploy with backups and Level 0 observability

## Phase 2
- Audio messages (transcription step; see `../integrations/ai-agent.md`)
- Receipt photos (Claude vision)
- Auto-recorded recurring entries (`auto_record`)
- Daily/weekly WhatsApp digest
- Commission waterfall automation
- NFC-e QR code reading (itemized receipts)
- Anti-ban practices for contact messaging

## Phase 3
- Statement and invoice import (OFX/CSV/PDF) with reconciliation against recorded transactions
- Goals and emergency reserve tracking
- Reports: month over month, category trends
- Cross-workspace grouped view
- Opening to friends: onboarding, invitations at scale, LGPD export/erasure flows

## Open questions
1. Real data for the couple's setup (accounts, cards, closing/due days, pay days): collected at onboarding, stored only in the DB, never in the repo.
2. Refund of installment purchases (`../domain/billing-and-installments.md`).
3. ~~Web auth method~~: password with server-side sessions, sign-up switch, reset by email (ADR 0021, ADR 0022).
4. Transcription for audio: local whisper.cpp vs external API.
5. Model for the agent: default `claude-opus-5`; test cheaper models once real message samples exist.
6. Alert channel (ntfy, Telegram, email). Must not be WhatsApp.
7. Remote access to the dashboard and deploy trigger (Tailscale vs Cloudflare Tunnel), see `../operations/deploy.md`.
8. Offsite backup destination.
9. Anti-ban practices for charges sent to contacts.
10. Email provider (SMTP) and sender domain with SPF/DKIM (ADR 0022). Needed before the first deploy.
