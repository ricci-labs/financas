---
summary: Data model overview — areas, conventions (IDs, tenancy keys, RLS, sign convention, enums vs config tables) and the map of all tables.
read_when: Before creating or changing any table, or to find which model doc covers an entity.
updated: 2026-09-25
---

# Data model

Status: **being implemented** in small PRs. Implemented so far: `users`, `user_preferences`, `workspaces`, `workspace_settings`,
`module_actions`, `roles`, `role_permissions`, `memberships`, `membership_preferences`, `invitations`,
`ledger_accounts`, `card_details`, `card_invoices`, `journal_entries`, `postings`.
The Drizzle schema (`apps/api/src/modules/*/*.table.ts`) is the source of truth for what exists;
these docs keep the *why*, the invariants and the examples.

Decisions: `../../decisions/0012-multi-tenancy.md`, `../../decisions/0013-double-entry-ledger.md`, `../../decisions/0014-enums-vs-config-tables.md`, `../../decisions/0015-module-permissions.md`, `../../decisions/0016-soft-delete.md`.

Diagrams (Mermaid, rendered by GitHub): `diagrams.md`.

## Areas
| Doc | Tables |
|---|---|
| `tenancy.md` | `users`, `channel_identities`, `sessions`, `workspaces`, `memberships`, `invitations`, `workspace_settings`, `user_preferences`, `membership_preferences` |
| `access-control.md` | `roles`, `role_permissions`, `module_actions` (module `access`) |
| `ledger.md` | `ledger_accounts`, `card_details`, `card_invoices`, `journal_entries`, `postings`, `institutions` |
| `planning.md` | `recurrence_rules`, `planned_occurrences`, `budget_lines`, `goals`, `holidays` |
| `third-parties.md` | `contacts`, `charges`, `charge_items`, `charge_payments` |
| `support.md` | `tags`, `entry_tags`, `files`, `entry_attachments`, `charge_attachments`, `notification_outbox`, `audit_log`, `agent_runs`, `agent_messages`, `pending_actions` |

## Map
```
GLOBAL (no tenant)     users ── channel_identities        institutions   holidays(national)
                         │
TENANCY                memberships ── workspaces ── workspace_settings
                                          │
      ┌───────────────────────────────────┼─────────────────────────────────────┐
LEDGER │ ledger_accounts ──┬── card_details ── card_invoices                      │
      │  (tree: assets,    │                        │                             │
      │   liabilities,     └──────────< postings >──┘──── contacts ── charges ──< charge_items
      │   categories…)                 │                                  └──< charge_payments
      │                        journal_entries ──< entry_tags >── tags
      │                                │  └──< entry_attachments >── files
PLAN  │ recurrence_rules ──< planned_occurrences ──(matched_entry)──┘
      │ budget_lines   goals   holidays(workspace)
      └── notification_outbox   audit_log   agent_runs/agent_messages/pending_actions
```

## Conventions (every table)
| Rule | Detail |
|---|---|
| Primary key | `id uuid`, default `uuidv7()` (native in Postgres 18). The app may pass its own id |
| Tenant key | Every tenant-owned table has `workspace_id uuid not null` and `unique (workspace_id, id)` |
| **Composite foreign keys** | Tenant tables reference each other with `(workspace_id, x_id) → parent(workspace_id, id)`. The database itself makes it impossible to link rows from different workspaces. |
| Row Level Security | Enabled on every tenant table, with a policy for `financas_app`: `workspace_id = app_current_workspace_id()`. The API connects as `financas_app` (not owner, no `BYPASSRLS`), so policies always apply. The workspace is set per transaction by `withWorkspace()` (ADR 0018). Cross-workspace jobs will use a separate `BYPASSRLS` role, only in `jobs/`. |
| Timestamps | `created_at timestamptz default now()`, `updated_at` kept by the `set_updated_at()` BEFORE UPDATE trigger, one per table, so every update bumps it, raw SQL included. Calendar dates are `date`. |
| Money | `bigint` cents. In postings the amount is signed (sign convention in `ledger.md`). Everywhere else it's `> 0` and the meaning comes from context. |
| Deletion | **Soft delete everywhere** (below). Hard delete only for LGPD erasure of a whole workspace and for purging trashed files. |
| Naming | snake_case tables in the plural; FK columns `<entity>_id`. |
| Global reference tables | Tables without `workspace_id` that hold fixed data (e.g. `module_actions`) are **read-only for the app role**: the migration revokes INSERT/UPDATE/DELETE/TRUNCATE from `financas_app`. |
| Pre-workspace lookups | A narrow `SECURITY DEFINER` function that returns only a workspace id (ADR 0019). `SET search_path`, `REVOKE ... FROM PUBLIC`, `GRANT EXECUTE` to the app role only. |
| Invariant triggers | Trigger functions that check a rule across rows are `SECURITY DEFINER` (run as owner, so RLS can't hide rows from the check), with `SET search_path` (ADR 0020). |
| Tenant policy | Every tenant table uses the `tenantIsolation(tableName, workspaceColumn)` helper (`core/db/tenancy.ts`). |

## Archive vs soft delete
Two different things, both reversible:

| | `archived_at` | `deleted_at` (+ `deleted_by_user_id`, `delete_reason`) |
|---|---|---|
| Meaning | "Not used anymore" (a closed account, an old category) | "This was a mistake / remove it" |
| History | **Still counts** in balances and reports | **Excluded** from balances, reports and pickers |
| Pickers | Hidden | Hidden |
| Where visible | Settings, with a "show archived" toggle | The **trash** (lixeira), for users with `delete` on the module |
| Restore | Unarchive (`update`) | Restore (`delete` permission) |

Rules:
- Every user-facing table has `deleted_at`, `deleted_by_user_id`, `delete_reason`. Config tables also have `archived_at`.
- Unique constraints are **partial** (`where deleted_at is null`), so a deleted name can be reused.
- Repositories filter `deleted_at is null` by default (`notDeleted()` helper). Only trash/audit queries opt out.
- You can't soft-delete a row that active rows depend on (an account with postings, a contact with an open balance). Archive it instead. Enforced by triggers.
- Every delete and restore writes to `audit_log`.
- Trashed rows are kept indefinitely (financial history), except **files**: a job purges trashed files from storage after 30 days.

## Enums vs configuration tables
Rule (ADR 0014): **a Postgres enum** when code branches on the value and users can't add values.
**A table** when users create, rename, order or configure the items.

| Postgres enums | Configuration tables |
|---|---|
| `app_module`, `permission_action`, `account_kind`, `entry_type`, `payment_method`, `entry_source`, `invoice_status`, `occurrence_status`, `charge_status`, `recurrence_frequency`, `period_anchor`, `notification_channel`, `notification_status`, `income_nature` | categories (as `ledger_accounts`), `tags`, `contacts`, `institutions`, `holidays`, `recurrence_rules`, `budget_lines`, `goals`, all `*_settings` / `*_preferences` |

Settings are **typed columns** in 1:1 tables (`workspace_settings`, `user_preferences`,
`membership_preferences`), not key-value rows, so every setting has a type, a default and constraints.

## Derived data (views, not tables)
`account_balances` ✅, `invoice_totals` ✅, `contact_balances`, `period_category_totals`,
`period_overview` (fixed income, spent, committed, free to spend). Materialize them only when
measurements show a need.

Every view is `security_invoker = true`: a Postgres view otherwise runs with its owner's
permissions and skips RLS. `core/db/conventions.integration.test.ts` fails on a view without it.
