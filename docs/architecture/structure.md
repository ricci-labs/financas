---
summary: The intended folder tree for the whole monorepo, with the role of every folder and file type.
read_when: Creating files or folders, or deciding where a piece of code belongs.
updated: 2026-10-01
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
├── docker/Dockerfile        # multi-stage build → slim runtime image (API now; the SPA joins with the web)
├── docker/entrypoint.sh     # migrate with the owner URL, then start the app without it
├── docker/backup/           # backup.sh (daily: dump + attachments, retention, rclone, Kuma) and restore.sh
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

One folder per domain concept, grouped by area like the API modules. Each concept folder holds its
code, its exported types (`<concept>.types.ts`), its schemas and its tests, side by side. Imports use
`@shared/<area>/<concept>/<file>`; everything public is re-exported by `index.ts`.

```
src/
├── core/                       # foundations every area uses
│   ├── money/                  # Cents: parse, format, sum, assertions
│   ├── calendar/               # IsoDate, business days, bank holidays, financial period
│   ├── paging/                 # cursor paging: schemas, pageOf
│   └── deletion/               # deletion request schema (optional reason)
├── identity/
│   ├── identity/               # email, password (12–128), display name, credentials
│   ├── workspaces/             # workspace name, settings schemas
│   ├── access/                 # modules, actions, system roles, role templates, can()
│   ├── members/                # member and role change schemas
│   ├── invitations/            # invitation schemas
│   └── notifications/          # notification preferences, quiet hours
├── ledger/
│   ├── ledger/                 # account kinds and classes, entry schemas, planPostings()
│   ├── cards/                  # billing cycle: which invoice a purchase falls into; invoice status
│   └── installments/           # split + multi-party allocation
├── contacts/
│   ├── contacts/               # contact schemas, contact balances
│   ├── charges/                # open items (payments on the oldest first) + the pt-BR message
│   └── pix/                    # Pix copia e cola (static BR Code with amount) + CRC-16
├── planning/
│   ├── planning/               # planning route schemas
│   ├── recurrence/             # dueDatesBetween, matching payments to occurrences
│   ├── budgets/                # budget schemas
│   ├── goals/                  # goal schemas
│   └── allocation/             # commission waterfall: steps + splitVariableIncome
├── reports/
│   ├── reports/                # report query schemas
│   ├── metrics/                # ADR 0024: one dashboard number per file, (facts) → value
│   ├── insights/               # ADR 0024: one alert per file, (facts, metrics) → Insight[]
│   └── simulation/             # "posso comprar?": a hypothetical purchase, before/after
├── attachments/                # file types, size limits, safe file names
├── audit/                      # audit query schemas
└── index.ts                    # public surface of the package
```

Inside a concept, the files follow the file roles: `metrics/` for example has `metrics.types.ts`
(PeriodFacts), `facts.ts` (helpers over the facts), one `<metric-name>.ts` per metric, `metrics.ts`
(METRICS, computeMetrics) and `metrics.test.ts`.

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
│   ├── storage/              # FileStorage (put/get/remove) and the local-disk implementation
│   ├── db/
│   │   ├── client.ts         # pg pool + Drizzle, readiness check
│   │   ├── columns.ts        # primaryId, timestamps, softDelete helpers
│   │   ├── errors.ts         # postgresErrorCode(): read the SQLSTATE of a failed query
│   │   ├── tenancy.ts        # app role + current workspace for RLS policies
│   │   ├── db.types.ts       # Database, WorkspaceTransaction, options
│   │   └── tx.ts             # withWorkspace(): sets app.workspace_id per transaction
│   ├── http/
│   │   ├── base-app.ts       # Hono app with the global middleware (request context, secure
│   │   │                     #   headers, 100 KB body limit (upload routes: FILE_MAX_BYTES), error and not-found handlers)
│   │   ├── middleware/       # request-context (request id, logger), error-handler, later auth
│   │   ├── validation.ts     # jsonBody(schema, code)
│   │   ├── http.types.ts     # AppEnv: request variables
│   │   └── errors.ts         # AppError hierarchy → HTTP status; parseOrThrow(schema, input, code)
│   ├── observability/        # OTel register, pino logger, metrics registry, spans, errors;
│   │                         #   operation-context.ts: trace id + source of the current work (ADR 0026)
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
│   ├── attachments/          # files + link tables (bytes behind core/storage)
│   ├── notifications/        # outbox, reminder scheduling, templates
│   ├── audit/                # append-only audit_log, recordAudit, GET /audit (ADR 0026)
│   └── reports/              # read-only: period facts → metrics and insights (ADR 0024)
├── ops/                      # operator commands, bundled into the image (dist/ops/*.mjs)
│   ├── terminal.ts           # prompts; secrets are read without echo
│   ├── create-user.ts        # first user + first workspace (pnpm ops:create-user)
│   ├── migrate.ts            # apply drizzle/ migrations as the owner (pnpm ops:migrate; image entrypoint)
│   └── run-job.ts            # run one scheduled job now, optionally at a fixed time (ops:job)
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
    ├── scheduler.ts          # startScheduler (one Cron per job, no overlap, stop waits for runs)
    │                         #   and runJob (logs job.run.*; a failure never stops the schedule)
    ├── scheduled-jobs.ts     # SCHEDULED_JOBS, the only list main.ts starts; schedule timezone
    ├── for-each-workspace.ts # forEachWorkspace: job_workspace_ids(), then work per workspace (ADR 0025)
    ├── plan-occurrences.ts   # 02:47: tops up every workspace's planned occurrences
    ├── queue-reminders.ts    # 08:07: bill and invoice reminders into the outbox
    ├── send-notifications.ts # every 5 min: delivers due outbox emails
    ├── purge-trashed-files.ts # 03:37: deletes files trashed 30+ days ago, bytes included
    ├── jobs.types.ts
    └── <job-name>.ts         # one ScheduledJob per file: name, cron pattern, run → one service
src/testing/                  # test helpers: database.ts (connections, Postgres error codes),
│                             #   fixtures.ts (users/workspaces through the real services),
│                             #   mailer.ts (recording Mailer), logger.ts (capturing logger),
│                             #   storage.ts (in-memory FileStorage),
│                             #   app.ts (test AppDeps), testing.types.ts (test-only shapes)
scripts/ops/                  # ops:* scripts (health, logs, trace, errors, metrics, job): Claude's stable interface (runbook.md);
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
└── index.ts                     # public surface: services, middleware and types, never routes
```

- Handlers stay inline in the routes file. Separate "controller" files break Hono's type inference and the RPC types.
- When a service passes ~300 lines, split it into `use-cases/<concept>.ts` (the use cases of one concept, e.g. `accounts.ts`, `entries.ts`; shared helpers in `use-cases/rules.ts`) and keep `*.service.ts` as a thin facade of re-exports. `modules/ledger` is the first example.
- `reports/` is read-only and has no tables: it loads the period facts through the `ledger`, `planning` and `workspaces` services and runs the shared metrics and insights over them (ADR 0024).
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
  | `index.ts` | Public surface: services, middleware and types. **Never routes**: `app.ts` mounts each module's routes straight from `<module>.routes.ts`, so any module's routes can import any other module (e.g. `access` for `authorize`) without an import cycle |

- If a module holds two concepts that feel separate, it is two modules (that's how `access` split from `workspaces`), not extra files inside one.

## apps/web
Rules for each layer: `web-application.md` (routes, data), `web-components.md` (components),
`web-design-tokens.md` (styles). Import rules: `dependency-rules.md` → Web.

```
index.html                   # theme-init.js first in <head>, two theme-color metas, no inline script
vite.config.ts               # react (+ React Compiler), @tailwindcss/vite, tanstack router, pwa
components.json              # shadcn config
public/                      # PWA icons, theme-init.js (the only file here with logic)
src/
├── main.tsx
├── app/                     # providers.tsx, router.ts (createApp), theme-provider.tsx
├── routes/                  # TanStack file-based routes; THIN, they only wire features
│   ├── __root.tsx
│   ├── (public)/            # login, signup, verify-email, forgot-password, reset-password, invite
│   ├── _app.tsx             # session guard + AppShell
│   ├── _app/w/$workspaceId/ # route.tsx (workspace + permissions), entries/, cards/, planning/...
│   └── dev/components.tsx   # workbench, development only
├── features/<feature>/      # auth, workspace, dashboard, entries, accounts, cards, planning, contacts...
│   ├── api/                 # <feature>.queries.ts + use-<verb>-<noun>.ts; the only backend access
│   ├── components/          # the feature's pages and parts
│   ├── hooks/
│   ├── <feature>.messages.ts
│   ├── <feature>.schemas.ts # search params and UI-only schemas (request bodies come from shared)
│   ├── <feature>.types.ts
│   └── index.ts             # what routes may import
├── components/
│   ├── ui/                  # shadcn primitives, close to upstream; only layer 2 imports them
│   └── <family>/<component>/ # design system: actions, inputs, forms, feedback, display, charts,
│                            # navigation, layout, finance, icons; one folder and file set each
├── lib/                     # api-client, api/ (ApiError, unwrap), query-client, query-keys,
│                            # navigation, router-context, errors/, format/, permissions, cn
├── hooks/                   # generic hooks only
└── styles/
    ├── globals.css          # imports + @layer base
    ├── tokens/              # semantic.css (roles), theme.css (utilities): the only home of visual values
    └── account-colors.ts    # the colour picker's choices
```
