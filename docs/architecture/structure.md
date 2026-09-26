---
summary: The intended folder tree for the whole monorepo, with the role of every folder and file type.
read_when: Creating files or folders, or deciding where a piece of code belongs.
updated: 2026-09-25
---

# Project structure

Once the scaffold exists, the real tree wins. Keep this file in sync when a folder's **role** changes.
Don't update it for every new file.

## Root

```
financas/
├── CLAUDE.md                # always-loaded instructions for Claude
├── apps/
│   ├── api/                 # backend: Hono + Baileys + agent + jobs (one process)
│   └── web/                 # frontend: Vite + React SPA
├── packages/
│   └── shared/              # Zod schemas, types, pure domain rules
├── docker/Dockerfile        # multi-stage build: web + api → slim runtime image
├── docs/                    # these docs
├── .github/                 # workflows (ci, deploy), PR template, dependabot
├── .claude/                 # project skills and Claude Code hooks (engineering/claude-workflow.md)
├── compose.dev.yml          # local Postgres 18 (dev and CI), roles from docker/postgres/init
├── scripts/                 # repo checks: no-comments, file roles, docs frontmatter/links
├── lefthook.yml             # git hooks
├── commitlint.config.ts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .dependency-cruiser.cjs
└── .env.example
```

Nested `CLAUDE.md` files go in `apps/api/` and `apps/web/` for app-specific commands and gotchas.
Claude Code loads them only when it works inside those folders.

## packages/shared

One folder per domain concept. Each folder holds its code, its exported types
(`<concept>.types.ts`) and its tests, side by side.

```
src/
├── money/
│   ├── money.types.ts        # Cents
│   ├── money.ts              # parse, format, sum, assertions
│   └── money.test.ts
├── calendar/
│   ├── calendar.types.ts     # IsoDate, YearMonth, PeriodSettings, Period
│   ├── dates.ts              # calendar-date math, business days, todayIn(timeZone)
│   ├── dates.test.ts
│   ├── period.ts             # financial period (configurable anchor)
│   └── period.test.ts
├── cards/
│   ├── cards.types.ts        # CardCycle, InvoiceRef
│   ├── billing-cycle.ts      # which invoice a purchase / installment falls into; invoice status
│   └── billing-cycle.test.ts
├── identity/
│   ├── identity.schemas.ts   # email, password (12–128), display name, credentials
│   └── identity.schemas.test.ts
├── installments/
│   ├── installments.ts       # split + multi-party allocation
│   └── installments.test.ts
├── access/
│   ├── access.constants.ts   # modules, actions, system role keys (+ derived types)
│   ├── access.types.ts       # Permission, RoleTemplate
│   ├── access.ts             # valid pairs, role templates, can()
│   └── access.test.ts
├── ledger/
│   ├── ledger.constants.ts   # account kinds, classes, entry types, payment methods, sources
│   ├── ledger.ts             # kind → class, system account names
│   ├── ledger.schemas.ts     # entryInputSchema, entryDetailsChangeSchema
│   ├── postings.types.ts     # EntryPlan, PostingDraft, PostingsViolation
│   ├── postings.ts           # planPostings(): entry plan → balanced posting drafts (incl. card installments)
│   └── *.test.ts
├── pix/                      # planned: Pix copia-e-cola payload
└── index.ts                  # public surface of the package
```

Rules: no I/O, no clock, no env (all pure). Zod schemas for a concept go in
`<concept>.schemas.ts` in the same folder. The domain rules live here, not in the API, because the
web needs them too. For example, the expense form previews the invoice and installments with the
same function the API uses to save.

## apps/api

```
drizzle/                      # generated SQL migrations (committed)
drizzle.config.ts
tsdown.config.ts              # production bundle (resolves @ aliases, inlines @financas/shared)
vitest.config.ts              # unit tests (no database)
vitest.integration.config.ts  # *.integration.test.ts against Postgres
src/
├── main.ts                   # boot: env, db, HTTP, WhatsApp, jobs, graceful shutdown
├── app.ts                    # Hono composition: global middleware, app.route() per module,
│                             #   static SPA; exports AppType for the RPC client
├── core/                     # cross-cutting infrastructure; knows no domain
│   ├── config/env.ts         # Zod-validated env, fails at boot
│   ├── email/                # Mailer (ADR 0022): SMTP via Nodemailer, or .eml files in development;
│   │                         #   layout.ts renders text + escaped HTML
│   ├── db/
│   │   ├── client.ts         # pg pool + Drizzle, readiness check
│   │   ├── columns.ts        # primaryId, timestamps, softDelete helpers
│   │   ├── errors.ts         # postgresErrorCode(): read the SQLSTATE of a failed query
│   │   ├── tenancy.ts        # app role + current workspace for RLS policies
│   │   └── tx.ts             # withWorkspace(): sets app.workspace_id per transaction
│   ├── http/
│   │   ├── base-app.ts       # Hono app with the global middleware (request context, secure
│   │   │                     #   headers, 100 KB body limit, error and not-found handlers)
│   │   ├── middleware/       # request-context (request id, logger), error-handler, later auth
│   │   ├── validation.ts     # jsonBody(schema, code)
│   │   ├── http.types.ts     # AppEnv: request variables
│   │   └── errors.ts         # AppError hierarchy → HTTP status; parseOrThrow(schema, input, code)
│   ├── observability/        # OTel register, pino logger, metrics registry, spans, errors
│   │                         #   (see docs/operations/observability.md)
│   ├── security/tokens.ts    # random tokens and their SHA-256 hashes
│   ├── security/passwords.ts # scrypt password hashing and verification (ADR 0021)
│   ├── concurrency.ts        # createConcurrencyLimit(): at most N async tasks at once
│   └── clock.ts              # injectable "now" (Clock, systemClock)
├── modules/                  # one folder per domain (see "Module anatomy")
│   ├── identity/             # users, sessions, channel identities (WhatsApp numbers)
│   ├── workspaces/           # workspaces, settings tables
│   ├── onboarding/           # flows spanning modules: createWorkspace() (no tables)
│   ├── access/               # module actions, roles, role permissions, authorization
│   ├── members/              # memberships (owner invariant), invitations
│   ├── ledger/               # ledger accounts (incl. categories), cards and invoices,
│   │                         #   journal entries, postings (cards live here: see dependency-rules)
│   ├── contacts/             # contacts, charges, settlements
│   ├── planning/             # recurrence rules, occurrences, periods, budgets, goals, holidays
│   ├── attachments/          # files + link tables, FileStorage interface
│   ├── notifications/        # outbox, reminder scheduling, templates
│   └── reports/              # read-only views: overview, balances, invoice totals
├── ops/                      # operator commands, bundled into the image (dist/ops/*.mjs)
│   ├── terminal.ts           # prompts; secrets are read without echo
│   └── create-user.ts        # first user + first workspace (pnpm ops:create-user)
├── channels/whatsapp/        # non-HTTP entry point
│   ├── connection.ts         # socket, reconnect with backoff
│   ├── auth-state.ts         # Baileys auth state stored in Postgres
│   ├── inbound.ts            # allowlist filter, message normalization
│   ├── outbound.ts           # rate-limited send queue
│   └── media.ts              # audio/image download
├── agent/
│   ├── client.ts             # Anthropic SDK instance
│   ├── run-agent.ts          # Tool Runner loop
│   ├── prompts/system.ts     # stable system prompt (cacheable)
│   ├── tools/                # one tool per file; each calls exactly one service
│   ├── memory.ts             # recent conversation per member
│   └── pending-actions.ts    # proposed writes awaiting confirmation
└── jobs/                     # croner schedules; each job calls services
src/testing/                  # test helpers: database.ts (connections, Postgres error codes),
│                             #   fixtures.ts (users/workspaces through the real services),
│                             #   mailer.ts (recording Mailer), logger.ts (capturing logger)
scripts/ops/                  # ops:* debugging scripts: Claude's stable interface (runbook.md);
                              #   commands that change data live in src/ops/ instead
```

### Module anatomy

```
modules/ledger/
├── ledger.routes.ts             # Hono sub-app; inline, thin handlers; zValidator
├── ledger.service.ts            # use cases; the only place with application logic
├── ledger.repository.ts         # Drizzle queries; the only file that touches the DB
├── ledger.table.ts              # Drizzle table definitions
├── ledger.types.ts              # exported types of the module
├── ledger.service.test.ts
└── index.ts                     # public surface: service + routes (nothing else)
```

- Handlers stay inline in the routes file. Separate "controller" files break Hono's type inference and the RPC types.
- When a service passes ~300 lines, split it into `use-cases/<concept>.ts` (the use cases of one concept, e.g. `accounts.ts`, `entries.ts`; shared helpers in `use-cases/rules.ts`) and keep `*.service.ts` as a thin facade of re-exports. `modules/ledger` is the first example.
- `reports/` is read-only: it has aggregate queries and no tables of its own.
- **Every module has the same fixed file set**, created only when needed and always with these names:

  | File | Holds |
  |---|---|
  | `<module>.table.ts` | All tables, enums and policies of the module (one file) |
  | `<module>.types.ts` | Exported types |
  | `<module>.repository.ts` | Drizzle queries |
  | `<module>.service.ts` | Use cases |
  | `<module>.routes.ts` | Hono sub-app |
  | `<module>.middleware.ts` | Hono middleware the module offers to other routes (e.g. `access`: `workspaceAccess`, `authorize`) |
  | `<module>.emails.ts` | Email templates: pure functions that return an `EmailMessage` (pt-BR text, rendered by `core/email/layout.ts`) |
  | `<module>.test.ts` / `<module>.integration.test.ts` | Unit / database tests, one `describe` per table or use case. A big module may split them by area: `<module>.<area>.integration.test.ts` |
  | `index.ts` | Public surface |

- If a module holds two concepts that feel separate, it is two modules (that's how `access` split from `workspaces`), not extra files inside one.

## apps/web

```
index.html
vite.config.ts               # react, @tailwindcss/vite, tanstack router, pwa
components.json              # shadcn config
public/                      # PWA icons
src/
├── main.tsx
├── app/{providers.tsx,router.ts}
├── routes/                  # TanStack file-based routes; THIN, they only compose features
│   ├── __root.tsx           # shell: sidebar / mobile bottom nav
│   ├── index.tsx            # dashboard
│   ├── transactions.tsx     # list with search params (?month=2026-09&category=...)
│   ├── cards/{index.tsx,$cardId.tsx}
│   ├── budget.tsx  login.tsx  settings.tsx
├── features/<name>/         # dashboard, transactions, cards, budgets, incomes, auth
│   ├── api/                 # TanStack Query hooks over the hc client; the only backend access
│   ├── components/
│   ├── hooks/
│   ├── <feature>.types.ts   # exported types of the feature
│   └── index.ts             # what routes may import
├── components/
│   ├── ui/                  # shadcn generated; edit only with a reason
│   └── layout/              # Sidebar, MobileNav, PageHeader, MonthPicker
├── lib/{api-client.ts,query-client.ts,utils.ts}
├── hooks/                   # generic hooks only
├── config/
└── styles/globals.css       # @import "tailwindcss"; theme tokens
```
