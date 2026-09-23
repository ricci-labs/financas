---
summary: Supporting tables — tags, attachments (receipts/notas), notification outbox (reminders, charges), audit log, agent runs/messages/pending actions.
read_when: Working on tags, file uploads/receipts, reminders and message sending, audit, or agent persistence.
updated: 2026-09-22
---

# Supporting tables

## Tags
- `tags`: `workspace_id`, `id`, `name` (unique per workspace), `color`, `archived_at`.
- `entry_tags`: `entry_id`, `tag_id`, PK on both. Free classification across categories ("viagem-praia", "casamento").

## Attachments (receipts, notas, comprovantes)
- `files`: `workspace_id`, `id`, `storage_key`, `mime_type`, `size_bytes`, `sha256`, `original_name`, `uploaded_by_user_id`, `source` (`web`, `whatsapp`).
  `unique (workspace_id, sha256)` avoids storing the same file twice.
- Link tables with real FKs, not a polymorphic `target_type` column:
  - `entry_attachments`: `entry_id`, `file_id`
  - `charge_attachments`: `charge_id`, `file_id`
  - more are added the same way when needed.
- Storage: a Docker volume at first, behind a `FileStorage` interface (`put/get/delete`), so an S3-compatible store can replace it by config.
- A receipt photo sent on WhatsApp during an expense conversation is attached to that entry.

## Notifications: `notification_outbox`
Every outgoing message (reminders, charges, digests, alerts to members) goes through this table.
| Column | Notes |
|---|---|
| `workspace_id`, `id` | |
| `recipient_user_id` or `recipient_contact_id` | Exactly one (CHECK) |
| `channel` | enum `notification_channel` |
| `kind` | enum: `bill_reminder`, `invoice_reminder`, `charge`, `charge_reminder`, `budget_alert`, `variable_income_suggestion`, `digest` |
| `payload` | jsonb (template data) |
| `scheduled_for` | timestamptz (respects quiet hours) |
| `status` | enum `notification_status`: `pending`, `sending`, `sent`, `failed`, `cancelled` |
| `attempts`, `last_error`, `sent_at` | |
| `dedupe_key` | unique, e.g. `bill_reminder:<occurrence_id>:<days_before>`, so the same reminder is never sent twice |

A worker claims rows with `FOR UPDATE SKIP LOCKED`, sends through the channel queue, and retries with backoff.

## `audit_log`
`workspace_id`, `id`, `at`, `actor_user_id` (null for jobs), `source`, `trace_id`, `action`
(`create`/`update`/`archive`/`reverse`), `table_name`, `row_id`, `before` jsonb, `after` jsonb.
Written by services (not DB triggers) so it carries the actor and trace. Ledger entries don't need
before/after, since reversals are self-documenting.

## Agent
- `agent_runs`: one row per agent turn (fields in `../../operations/observability.md` → Agent run records) + `workspace_id`, `user_id`.
- `agent_messages`: conversation memory per (`workspace_id`, `user_id`): `role`, `content` jsonb, `created_at`. Trimmed by age.
- `pending_actions`: `workspace_id`, `user_id`, `kind`, `payload` jsonb (the validated service input), `preview_text`, `expires_at`, `status` (`pending`, `confirmed`, `cancelled`, `expired`). At most one `pending` per (workspace, user) (partial unique index).
