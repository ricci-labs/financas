---
summary: Identity and multi-tenancy tables — users, WhatsApp identities, workspaces, memberships, invitations — and all settings/preferences tables (financial period, installment view, notifications).
read_when: Working on auth, workspaces, memberships, invitations, settings screens, or anything scoped by tenant.
updated: 2026-09-22
---

# Tenancy, identity and settings

## Concepts
- **User:** a person who logs in. Global, not owned by a workspace.
- **Workspace:** an isolated space with its own accounts, entries and settings (e.g. "Casa", "Pessoal"). Anyone can create several. Workspaces never share data. A grouped view across workspaces is a future feature, built as a read-only aggregation, never as shared rows.
- **Membership:** links a user to a workspace with a role. **Every member sees everything in the workspace**; there is no per-account privacy inside a workspace.

## Global tables
### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | citext unique | Login identifier |
| `display_name` | text not null | |
| `password_hash` | text null | Null if passwordless (auth method decided at scaffold) |
| `email_verified_at` | timestamptz null | |
| `disabled_at` | timestamptz null | |

### `channel_identities`: how a user is reached and recognized outside the web
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | FK users | |
| `channel` | enum `notification_channel` (`whatsapp`, `email`) | |
| `address` | text | WhatsApp: E.164 (`+55...`). Unique per channel. |
| `verified_at` | timestamptz null | Only verified identities can talk to the agent |

The WhatsApp agent looks up `channel_identities` → `user` → the workspace (`user_preferences.default_workspace_id`, switchable by message).

### `sessions`
Web sessions: `id`, `user_id`, `token_hash`, `expires_at`, `last_seen_at`, `user_agent`.

## Tenant tables
### `workspaces`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Also the tenant key |
| `name` | text not null | |
| `created_by_user_id` | FK users | |
| `archived_at` | timestamptz null | |

### `memberships`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `user_id` | FKs | `unique (workspace_id, user_id)` |
| `role` | enum `membership_role`: `owner`, `admin`, `member`, `viewer` | At least one `owner` per workspace (trigger) |

| Role | Can |
|---|---|
| `owner` | Everything, including deleting the workspace and managing owners |
| `admin` | Settings, accounts, categories, members (except owners) |
| `member` | Record and edit entries, contacts, charges |
| `viewer` | Read only |

### `invitations`
`workspace_id`, `email` or `phone_e164`, `role`, `token_hash`, `invited_by_user_id`, `expires_at`, `accepted_at`.

## Settings (typed 1:1 tables)
### `workspace_settings` (PK = `workspace_id`)
| Column | Type | Default | Meaning |
|---|---|---|---|
| `currency` | char(3) | `BRL` | Default currency for new accounts |
| `timezone` | text | `America/Sao_Paulo` | All "today" logic |
| `locale` | text | `pt-BR` | Formatting and agent language |
| `period_anchor` | enum `period_anchor`: `calendar_month`, `day_of_month`, `nth_business_day` | `calendar_month` | How the **financial month** starts |
| `period_anchor_value` | smallint null | null | Day (1–31) or N (1–10), depending on the anchor |
| `installment_budget_view` | enum: `purchase_month`, `per_installment` | `per_installment` | How installment purchases count in budgets (reports only, see `ledger.md`) |
| `budget_base` | enum `income_nature`: `fixed`, `all` | `fixed` | The budget is sized from fixed income only (the household policy) |
| `variable_income_target_account_id` | FK ledger_accounts null | null | Where the "guardar o variável" suggestion moves money (e.g. the reserve) |
| `week_starts_on` | smallint | 0 (Sunday) | |
| `pix_receiving_key` | text null | null | Key put in charge messages (Pix copia-e-cola) |
| `pix_receiver_name`, `pix_receiver_city` | text null | null | Required by the Pix payload format |
| `contact_messages_daily_cap` | smallint | 20 | Anti-ban guard for charges to contacts |
| `charge_reminder_every_days` | smallint null | 3 | Re-send interval for unpaid charges; null = no reminders |

**Financial period examples** (`planning.md` has the algorithm):
| Anchor | Value | Period labeled `2026-10` |
|---|---|---|
| `calendar_month` | — | 2026-10-01 → 2026-10-31 |
| `day_of_month` | 5 | 2026-10-05 → 2026-11-04 |
| `day_of_month` | 31 | 2026-10-31 → 2026-11-29 (a day missing in a month → last day of that month) |
| `nth_business_day` | 5 | 5th business day of October → the day before the 5th business day of November (uses `holidays`) |

### `user_preferences` (PK = `user_id`)
`default_workspace_id`, `language`, `quiet_hours_start`, `quiet_hours_end` (no notifications in that window).

### `membership_preferences` (PK = `workspace_id, user_id`)
| Column | Default | Meaning |
|---|---|---|
| `notify_bills_days_before` | 3 | Reminder lead time for bills and invoices |
| `notify_channel` | `whatsapp` | |
| `notify_daily_digest` | false | |
| `notify_budget_threshold_pct` | 80 | Alert when a category reaches this % of its budget |
| `notify_variable_income` | true | Suggest moving variable income to savings when it arrives |
