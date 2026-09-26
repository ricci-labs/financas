---
summary: Coding conventions — naming, money, dates, IDs, errors, validation, tests, migrations, commits.
read_when: Writing or reviewing any code.
updated: 2026-09-25
---

# Conventions

## Language
- Code, identifiers, file names, URLs, commits and docs are in English.
- Product text for the app's users is in pt-BR: the web UI, agent replies, WhatsApp messages and
  emails.
- Everything for the operator or the developer is in English: ops command prompts and output
  (`src/ops/`), error codes and messages, logs, env var names and their validation messages.
- Domain terms come from `../domain/glossary.md`.

## Code style (ADR 0017)
The code must read like well-written prose: a person should understand it top to bottom
without comments.

- **No comments.** Only tool directives (`biome-ignore`, `@ts-expect-error`) with their reason. The "why" goes in docs/ADRs. Checked by `pnpm lint:comments`.
- **Names carry intent.** Full words, no abbreviations (`installment`, not `inst`). Booleans read as questions (`isOnClosingDay`, `goesToNextInvoice`). Functions are verbs (`splitInstallments`); values are nouns.
- **Name intermediate results.** Prefer `const isAfterClosing = ...` over a long inline condition.
- **Small functions, one level of abstraction.** Extract helpers with descriptive names instead of explaining a block.
- **Early returns and guard clauses**, not deep nesting. Always use braces.
- **No magic numbers or strings.** Use named constants (`CENTS_PER_REAL`, `SHUTDOWN_TIMEOUT_MS`).
- **No clever code.** No nested ternaries, no comma operators, no bit tricks, no single-letter names except `c` in Hono handlers and index-free callbacks.
- **Public functions first**, private helpers below them, in the order they're called.
- **Named exports only** (default exports only where a tool requires them, e.g. config files).
- **Formatting is not a discussion:** Biome formats everything (2 spaces, single quotes, no semicolons, 100 columns).

## File organization
- **One folder per concept** (a domain concept in `shared`, a module in the API, a feature in the web).
- **Exported types live in `<concept>.types.ts`** in that folder. A type used only inside one file may stay in it, unexported. Types derived from a value (`z.infer<typeof schema>`, `ReturnType<typeof fn>`) stay next to that value.
- **Tests sit next to the code** they test: `money.ts` + `money.test.ts`. No separate test trees.
- Zod schemas go in `<concept>.schemas.ts`. Tables in `<module>.table.ts`.
- Each folder exposes its public surface through the package or module `index.ts`.

## Imports
- Cross-folder imports use the package alias: `@api/...`, `@web/...`, `@shared/...` (declared in `tsconfig.base.json`).
- Other workspace packages are imported by their name (`@financas/shared`), never through their alias from another package's runtime code.
- No relative `../` imports and no file extensions in import paths.
- Type-only imports use `import type`.

## Naming
| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case, role suffix in API modules (enforced by Biome) | `ledger.service.ts`, `billing-cycle.ts`, `expense-form.tsx` |
| React components | PascalCase exports, kebab-case files | `export function ExpenseForm` in `expense-form.tsx` |
| Zod schemas | camelCase + `Schema` | `createExpenseSchema` |
| Inferred types | PascalCase, same stem | `type CreateExpense = z.infer<typeof createExpenseSchema>` |
| DB tables/columns | snake_case in SQL, camelCase in TS (Drizzle `casing: 'snake_case'`) | `amount_cents` ↔ `amountCents` |
| Money fields | suffix `Cents` | `limitCents` |
| Month fields | `YYYY-MM` string, suffix `Month` | `referenceMonth: '2026-10'` |

## Money
- Store and compute in integer cents (`integer`/`bigint` columns, `number` in TS; the household's values stay far below 2^53).
- Parse user input like `"87,50"`, `"R$ 1.234,56"` or `"1234.5"` only through `@shared/money/money`.
- Format for display with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` via `@shared/money/money`.
- Split amounts only with `@shared/installments/installments`. Never with ad-hoc division.

## Dates
- Calendar dates (`occurredOn`, `closingDate`, `dueDate`) are `date` columns and `YYYY-MM-DD` strings in TS. They are not `Date` objects, which avoids timezone shifts.
- Timestamps (`createdAt`) are `timestamptz`.
- "Today" is computed in `America/Sao_Paulo` through `core/clock.ts`. Pure domain functions take it as a parameter. Services take an optional `clock: Clock = systemClock` argument so tests can move time (e.g. an expired invitation).

## IDs
- UUID v7 (time-ordered), default `uuidv7()` in Postgres 18. The app may pass its own id when it needs it before the insert.

## Configuration (ADR 0023)
- Everything that changes from one instance to another comes from env vars: URLs, credentials,
  providers, feature switches (`PUBLIC_SIGNUP_ENABLED`). Never hard-code a household's or an
  operator's value.
- Every var is declared in `core/config/env.ts` (Zod), with a default when a safe one exists, and
  the app refuses to boot with a message naming each invalid or missing var.
- A var that is required only in production is optional in the schema and checked by a production
  rule, so local development works with the defaults.
- The PR that adds a var also documents it in `.env.example` (with a comment line saying what it
  does) and in `../operations/deploy.md`.
- Code reads config only through the `Env` object passed down from `main.ts`, never
  `process.env` directly.
- Settings a user changes from the app belong in the database (`workspace_settings`,
  `user_preferences`), not in env.

## Passwords and secrets (ADR 0021)
- Hash and verify only through `core/security/passwords.ts`: scrypt at the OWASP cost, a random
  salt per password, constant-time comparison, NFKC normalization.
- At most two derivations run at once (about 256 MB); the rest wait in line. A stored hash with a
  cost above the accepted maximum is refused before any memory is allocated.
- A login for an unknown user or a user without a password calls `verifyPassword(input, null)`,
  which does the same work as a real check. Every failure gives the same answer.
- After a successful login, if `passwordNeedsRehash()` is true, store a new hash at the current cost.
- `password_hash` is read only by the identity repository, to hand it to `verifyPassword()`.
  Queries select explicit columns, and no API response, agent tool result or log ever carries it.
- Password length is 12 to 128 characters, checked by the shared schema before hashing.
- Raw tokens (session cookie, email links) exist only on the user's side. The database stores
  their SHA-256, and lookups go by that hash.
- Never log a request body. The logger censors passwords, hashes, tokens, cookies and the
  authorization header at the top level and one level down (`core/observability/logger.ts`, with a
  test). Name fields so the censor catches them (`password`, `newPassword`, `token`, `tokenHash`).

## HTTP routes and sessions (ADR 0021)
- **Every `/api` route needs a session by default.** `requireSession` (`core/http/middleware/session.ts`)
  runs before every route and answers `401 SESSION_REQUIRED` unless the route's `METHOD /path` is in
  `PUBLIC_ROUTES` (`app.ts`), built from each module's `PUBLIC_*_ROUTES` export. A test walks every
  registered route and fails if a non-public one answers without a session.
- Handlers read the user with `currentSession(c)`, never from the body or the URL.
- **Writes come only from the app's own pages:** every non-GET request under `/api` must carry
  `Sec-Fetch-Site: same-origin` or `Origin` equal to `PUBLIC_URL`, or it gets
  `403 CROSS_SITE_REQUEST` (`same-origin-writes.ts`). Together with the `SameSite=Lax` cookie, that's
  two independent CSRF barriers. It's stricter than Hono's `csrf()`, which only checks form-like
  content types.
- **Login lockout** (`identity.routes.ts`, `core/security/attempt-limiter.ts`): failed logins are
  counted per email and per client address in a fixed window (defaults 5 and 30 in 15 minutes, env).
  While either is over the limit, login answers `429 TOO_MANY_ATTEMPTS` with `Retry-After`, before
  any password hashing, even for the right password. Only wrong credentials count; a success clears
  the email's count. Memory is capped (oldest keys dropped first).
- **Routes that send account emails** (sign-up, verification resend, forgot password) validate the
  input, check the switch and the limits (per address and per client, per hour), then answer
  `202` with an empty body **before** doing the work, which runs through `BackgroundTasks`
  (`core/background-tasks.ts`). The response is the same whether the email exists or not, and its
  timing doesn't depend on it. A failed task is logged as `background.task.failed`; shutdown waits
  for pending tasks.
- **Routes that use an email link** (`POST /api/auth/verify-email`, `/password/reset`) take the
  token in the body (the web reads it from the URL fragment). Each `LINK_INVALID` counts against the
  client (default 20 per hour); over the limit they answer `429` even for a valid link. A reset
  checks the link with a read-only query **before** hashing the new password, so fake links can't
  make the server spend scrypt memory and time. It also clears the caller's session cookie, since
  every session of the user ends.
- The client address is the socket address, or with `TRUSTED_PROXY_HOPS = n` the `X-Forwarded-For`
  entry `n` from the right (`core/http/client-ip.ts`). Entries a client writes further left are ignored.
- The session cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, with the session expiry. In production
  it's `__Host-session` and `Secure`, in development `session` (`core/http/session-cookie.ts`). A
  cookie that doesn't resolve to a session is cleared.

## Validation and errors
- Validate at every boundary with Zod: HTTP (`zValidator`), agent tool inputs, env, WhatsApp payloads.
- Services throw typed `AppError` subclasses. The HTTP error handler (`core/http/middleware/error-handler.ts`) maps them to status codes; agent tools map them to `is_error` tool results.

  | Error | Status |
  |---|---|
  | `ValidationError` | 400 |
  | `UnauthorizedError` | 401 |
  | `ForbiddenError` | 403 |
  | `NotFoundError` | 404 |
  | `ConflictError` | 409 |
  | anything else | 500 `INTERNAL_ERROR`, logged once as `http.request.failed`; the message never reaches the client |
- Every error response has the same body: `{ "error": { "code", "message", "ref" } }`. The web shows pt-BR text chosen by `code`, plus the `ref`.
- Routes validate bodies with `jsonBody(schema, 'X_INVALID')` (`core/http/validation.ts`, Hono's built-in validator + `parseOrThrow`), so validation errors take the same path. Bodies above 100 KB are refused with 413 before being read.
- Never swallow errors. Log with context using the pino child logger.

## Tests
- Vitest, colocated `*.test.ts`.
- Priority: `packages/shared` (every example in `../domain/billing-and-installments.md` is a test) → services → routes.
- Tests that need the database are `*.integration.test.ts` and run with `pnpm test:integration` (after `pnpm db:up`). They connect as the app role (RLS applies) and seed or clean up with the owner connection. They clean up everything they create.
- Assert the **exact Postgres error** with `postgresErrorCodeOf()` and `POSTGRES_ERRORS` (`src/testing/database.ts`), never a bare `rejects.toThrow()`, so a test can't pass for the wrong reason.
- Seed through `createFixtures()` (`src/testing/fixtures.ts`), which uses the real services (e.g. `createWorkspace()`), so tests run on the real flow. Call `removeEverything()` in `afterAll`.
- **Tests are independent:** each test creates the users it changes, so order doesn't matter. Never start two DB operations without awaiting the first (they would run as parallel transactions).
- For a DB rule (trigger, policy, constraint), prove the test can fail: disable the rule locally, see the test go red, re-enable.
- **Races must be tested deterministically.** Firing concurrent calls and hoping they overlap passes by luck. Hold a lock from the owner connection (e.g. `lock table ... in exclusive mode`) so the racing calls queue up, wait for them with `waitForBlockedQueries()`, then release. Example: the invitation race test in `members.integration.test.ts`.
- `pnpm test` never needs a database.
- The agent gets an eval set of real anonymized messages later (see `../integrations/ai-agent.md`).

## Migrations
- Change `*.table.ts`, run `pnpm db:generate --name=<what_changed>`, **read the SQL**, commit it. Never edit an applied migration.
- SQL that Drizzle can't express (functions, triggers) goes in a custom migration: `pnpm db:generate --custom --name=<what>`, then write the SQL in the generated file.
- CI fails if a table definition changed without its migration.
- **CHECK constraints must handle NULL explicitly.** A CHECK passes when its expression is NULL, so `value between 1 and 31` accepts a NULL `value`. Write `value is not null and value between 1 and 31`, or compare nullness directly (`(a is null) = (b is null)`). Add a test with the NULL case.
- **Workspace erasure must keep working.** A foreign key between tenant tables that doesn't cascade is `DEFERRABLE INITIALLY DEFERRED` (Drizzle can't express it: `alter constraint` in a custom migration); otherwise the cascade checks it before the referencing rows are gone. Every area has an erasure test with its rows filled in.
- A trigger that forbids hard deletes must still let a whole workspace be erased: allow the delete when `workspace_is_being_erased(workspace_id)` is true, and add an erasure test.
- A view is `security_invoker = true` (Drizzle: `pgView(...).with({ securityInvoker: true })`), or it skips RLS. The conventions test checks it.
- A new table with `timestamps()` needs its `updated_at` trigger in a custom migration: `create trigger <table>_set_updated_at before update on <table> for each row execute function set_updated_at();`.
- A trigger that checks an invariant across rows uses a `SECURITY DEFINER` trigger function with `SET search_path = public, pg_temp` (ADR 0020). Test it with a workspace switch in the same transaction.
- A migration that exists only on your machine (not merged) may be regenerated. Delete its SQL, snapshot and journal entry, then `pnpm db:reset` and migrate. Once merged, never edit it.
- Shared column helpers (`core/db/columns.ts`): `primaryId()`, `timestamps()`, `softDelete(() => users.id)` (`deleted_at`, `deleted_by_user_id`, `delete_reason`). Use them in every table. `core/db/conventions.integration.test.ts` fails if a table has only part of a convention.
- A destructive change (drop/rename) needs an explicit mention to the user before it runs anywhere with real data.

## Logging
- Use the module's child logger. Never `console.log`.
- Every log that matters has a catalog `event` name (`../operations/observability.md`). Put data in fields, not in the message string.

## Commits
See `../engineering/git-workflow.md`.
