---
summary: Coding conventions — naming, money, dates, IDs, errors, validation, tests, migrations, commits.
read_when: Writing or reviewing any code.
updated: 2026-09-23
---

# Conventions

## Language
- Code, identifiers, file names, URLs, commits and docs are in English.
- User-facing text (UI, agent replies) is in pt-BR.
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
- Parse user input like `"87,50"`, `"R$ 1.234,56"` or `"1234.5"` only through `money.ts`.
- Format for display with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` via `money.ts`.
- Split amounts only with `installments.ts`. Never with ad-hoc division.

## Dates
- Calendar dates (`occurredOn`, `closingDate`, `dueDate`) are `date` columns and `YYYY-MM-DD` strings in TS. They are not `Date` objects, which avoids timezone shifts.
- Timestamps (`createdAt`) are `timestamptz`.
- "Today" is computed in `America/Sao_Paulo` through `core/clock.ts`. Pure domain functions take it as a parameter.

## IDs
- UUID v7 (time-ordered), generated in the app.

## Validation and errors
- Validate at every boundary with Zod: HTTP (`zValidator`), agent tool inputs, env, WhatsApp payloads.
- Services throw typed `AppError` subclasses (`NotFoundError`, `ValidationError`, `ConflictError`). The HTTP error middleware maps them to status codes. Agent tools map them to `is_error` tool results.
- Never swallow errors. Log with context using the pino child logger.

## Tests
- Vitest, colocated `*.test.ts`.
- Priority: `packages/shared/src/domain` (every example in `../domain/billing-and-installments.md` is a test) → services → routes.
- Service tests use a real Postgres (a throwaway database), not mocks of the repository.
- The agent gets an eval set of real anonymized messages later (see `../integrations/ai-agent.md`).

## Migrations
- Change `*.table.ts`, run `drizzle-kit generate`, read the SQL, commit it. Never edit an applied migration.
- A destructive change (drop/rename) needs an explicit mention to the user before it runs anywhere with real data.

## Logging
- Use the module's child logger. Never `console.log`.
- Every log that matters has a catalog `event` name (`../operations/observability.md`). Put data in fields, not in the message string.

## Commits
See `../engineering/git-workflow.md`.
