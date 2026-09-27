---
summary: Supporting tables — tags, attachments (receipts/notas), notification outbox (reminders, charges), audit log, agent runs/messages/pending actions.
read_when: Working on tags, file uploads/receipts, reminders and message sending, audit, or agent persistence.
updated: 2026-09-26
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

Implemented (`modules/notifications`):
- `dedupe_key` is unique per workspace;
- `sent_at` is set exactly when sent (CHECK);
- exactly one recipient (CHECK); a user recipient is removed with the user; the contact FK is
  deferred.

`enqueueNotification(tx, { workspaceId, recipient: { userId } | { contactId }, channel, kind,
payload, dueAt, dedupeKey })` inserts once per key (`{ isNew }`).

**Worker** (job `send-notifications`, every 5 minutes, per workspace, ADR 0025):
`deliverDueNotifications` claims up to 20 pending **email** rows due now (`FOR UPDATE SKIP LOCKED`),
writes the pt-BR email (`notifications.emails.ts`: `bill_reminder`, `invoice_reminder`, payloads
validated by the shared schemas) and sends it through the `Mailer`. Outcomes:
- sent → `sent` + `sent_at`, event `notification.sent`;
- a send error → retried after 2^attempts minutes (2, 4, 8, 16), then `failed` at the fifth attempt;
- a payload it can't write, or a contact recipient by email → `failed` at once.

Failures log `notification.failed` (`willRetry`). WhatsApp rows stay pending until that channel
exists.

**Reminders** (job `queue-reminders`, daily at 08:07, per workspace; `queueReminders`). For each
active member, with their `membership_preferences.notify_bills_days_before` (default 3):
- a `bill_reminder` for each pending **expense** occurrence due from today to today + that lead time
  (card subscriptions are covered by the invoice);
- an `invoice_reminder` for each card invoice due in that window with something still due.

Dedupe keys are `bill_reminder:<occurrence>:<user>` and `invoice_reminder:<invoice>:<user>`, so each
member gets each reminder once, even when the job runs again or a day is missed. The channel is
email until the WhatsApp channel exists, whatever `notify_channel` says. For a member, `scheduled_for` is
`dueAt` moved past their quiet hours in the workspace time zone (shared `outsideQuietHours`: a window
across midnight wakes the next morning). Producers call it inside their own workspace transaction.

## `audit_log`
`workspace_id`, `id`, `at`, `actor_user_id` (null for jobs), `source`, `trace_id`, `action`
(`create`/`update`/`archive`/`unarchive`/`delete`/`restore`), `table_name`, `row_id`, `before` jsonb, `after` jsonb.
Written by services (not DB triggers) so it carries the actor and trace. Entry edits are self-documenting too
(`replaces_entry_id`), but they are still logged for a single timeline.

## Agent
- `agent_runs`: one row per agent turn (fields in `../../operations/observability.md` → Agent run records) + `workspace_id`, `user_id`.
- `agent_messages`: conversation memory per (`workspace_id`, `user_id`): `role`, `content` jsonb, `created_at`. Trimmed by age.
- `pending_actions`: `workspace_id`, `user_id`, `kind`, `payload` jsonb (the validated service input), `preview_text`, `expires_at`, `status` (`pending`, `confirmed`, `cancelled`, `expired`). At most one `pending` per (workspace, user) (partial unique index).
