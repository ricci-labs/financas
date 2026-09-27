---
summary: Supporting tables — tags, attachments (receipts/notas), notification outbox (reminders, charges), audit log, agent runs/messages/pending actions.
read_when: Working on tags, file uploads/receipts, reminders and message sending, audit, or agent persistence.
updated: 2026-09-27
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
- Storage: a Docker volume at first, behind a `FileStorage` interface (`core/storage`: `put`, `get`, `remove`), so an S3-compatible store can replace it by config. `createLocalFileStorage(FILE_STORAGE_DIR)` stores a file at `<workspace id>/<sha256>`; any other key shape is refused, so nothing can escape the directory.
- A receipt photo sent on WhatsApp during an expense conversation is attached to that entry.

Implemented (`modules/attachments`):
- **The type comes from the bytes**, never from the name or the declared type (`detectedMimeTypeOf`,
  shared): JPEG, PNG, WebP, HEIC and PDF. Anything else is `400 FILE_TYPE_NOT_ALLOWED`; an empty or
  missing file is `400 FILE_REQUIRED`; above `FILE_MAX_BYTES` is `413 FILE_TOO_LARGE`. The name keeps
  only its base name without control characters, up to 255 characters (`attachmentNameOf`).
- **Stored once per content:** the same bytes again reuse the file row (restoring it if trashed), and
  the bytes are written inside the transaction, after the row is locked.
- **Detaching** removes the link; a file no longer linked anywhere goes to the trash
  (`deleted_at`). The file row is locked first, so a concurrent attach can't be lost.
- **Editing an entry** (replace) moves its attachments to the new entry (constraint trigger
  `entry_attachments_follow_replaced_entry`, like planned occurrences). A deleted entry keeps them, so
  a restore brings them back.
- Composite, deferred FKs to the entry and the file; RLS on both tables.

- **Charges** hold payment receipts the same way (`charge_attachments`, any charge status). A file
  may be attached to entries and charges at once; it's trashed only when the last link goes.
- **Purge** (job `purge-trashed-files`, daily at 03:37, per workspace, ADR 0025): files trashed more
  than `TRASHED_FILE_RETENTION_DAYS` (30) ago and linked nowhere are deleted with their bytes, up to
  100 per workspace a night (`FOR UPDATE SKIP LOCKED`). The bytes are removed inside the
  transaction, before the row goes, so an upload of the same content waits and writes them again.
  `job.run.completed` reports `purged`.

`:target` is `entries/:entryId` or `charges/:chargeId` (`404 ENTRY_NOT_FOUND` / `CHARGE_NOT_FOUND`):

| Route | Permission | Does |
|---|---|---|
| `GET /:target/attachments` | `attachments:view` | `{ fileId, name, mimeType, sizeBytes, attachedAt, attachedByUserId }` of an active entry or a charge |
| `POST /:target/attachments` | `attachments:create` | Multipart field `file` → `201 { fileId }` |
| `DELETE /:target/attachments/:fileId` | `attachments:delete` | Detach (and trash the file when unlinked) |
| `GET /files/:fileId` | `attachments:view` | The bytes, `inline` with the name, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store` |

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

Implemented (`modules/audit`, ADR 0026):
- `recordAudit(tx, { workspaceId, actorUserId, action, tableName, rowId, before?, after? })` inserts
  in the caller's transaction; `source` (`web`, `whatsapp`, `job`, `ops`, `system`) and `trace_id`
  come from the operation context. `actor_user_id` becomes null if the user is erased.
- **Append-only:** `financas_app` may only `select` and `insert` (RLS policies per command, and
  `UPDATE`/`DELETE`/`TRUNCATE` revoked). The rows go only with the workspace.
- `before` and `after` are the row as stored, as JSON. Entries include their postings. Entry
  actions:
  - `create`, with `after`;
  - `update`: a details change, or a replacement logged on the **new** entry, with the old one as
    `before`;
  - `delete` and `restore`.
- `GET /audit?tableName=&rowId=&cursor=&limit=` (`audit:view`: owner and admin) pages newest first.

## Agent
- `agent_runs`: one row per agent turn (fields in `../../operations/observability.md` → Agent run records) + `workspace_id`, `user_id`.
- `agent_messages`: conversation memory per (`workspace_id`, `user_id`): `role`, `content` jsonb, `created_at`. Trimmed by age.
- `pending_actions`: `workspace_id`, `user_id`, `kind`, `payload` jsonb (the validated service input), `preview_text`, `expires_at`, `status` (`pending`, `confirmed`, `cancelled`, `expired`). At most one `pending` per (workspace, user) (partial unique index).
