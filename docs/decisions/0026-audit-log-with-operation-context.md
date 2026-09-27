---
summary: Services write audit_log rows in the same transaction as the change; the trace id and source come from an operation context (AsyncLocalStorage) opened by the HTTP middleware and the job runner; the table is append-only for the app role.
read_when: Writing a service that creates, changes, archives, deletes or restores tenant data, or reading the audit trail.
updated: 2026-09-27
---

# 0026. Audit log written by services, with an operation context

- **Status:** Accepted
- **Date:** 2026-09-27
- **Refines:** the `audit_log` model in `docs/domain/model/support.md` ("written by services, not DB
  triggers, so it carries the actor and trace").

## Context
- The household needs one timeline of who changed what, from which channel: web, WhatsApp, jobs.
- Services know the actor (they receive `userId`), but not the trace id or the channel. Passing
  both through every service signature would touch every call site and every test.
- DB triggers see neither the actor nor the trace, unless every transaction sets them as settings.

## Decision
- **Operation context** (`core/observability/operation-context.ts`): an `AsyncLocalStorage` holding
  `{ traceId, source, actorUserId }`.
  - The HTTP request middleware opens it with the request id and `web`.
  - The job runner opens it with a new trace id per run and `job`, and logs that `trace_id`.
  - The session middleware adds the logged-in user as the actor (`runAsActor`). Flows without a
    session run as the user they identify (a new owner, a new member signing up by invitation).
  - The WhatsApp channel will open it with `whatsapp` and the member it identified.
  - Outside any operation, it is `{ traceId: null, source: 'system', actorUserId: null }`.
  - OTel (step 7) can later supply the trace id from the active span, without changing callers.
- **`recordAudit(tx, change)`** (`modules/audit`) inserts one row in the service's transaction, so
  the audit row and the change commit or roll back together. The change carries `workspaceId`,
  `action`, `tableName`, `rowId`, `before` and `after`. `source`, `trace_id` and, unless the change
  names one, the actor come from the operation context.
- **Helpers for the common case:** `auditCreation(tx, target)` and
  `audited(tx, target, action, change)` read the row before and after by an `AuditTarget` (table, key
  column, row id, and columns to leave out, such as an invitation's `token_hash`). Each repository
  builds its own targets, so the table objects never leave their module. Sets that change together (allocation steps) or link rows (attachments) call
  `recordAudit` with their own snapshot.
- **Append-only:** the app role has RLS policies for `select` and `insert` only, and `UPDATE`,
  `DELETE` and `TRUNCATE` are revoked. The rows go only with the workspace (LGPD erasure cascades).
- The trail is read through `GET /audit` with `audit:view`.

## Alternatives considered
- Triggers on every table: they miss the actor and trace unless every transaction sets them, and
  they would log internal bookkeeping (balances, invoice totals) as if a person did it.
- Explicit `traceId`/`source`/`userId` parameters: correct, but noisy in every signature, and easy
  to forget.

## Consequences
- Each write use case calls `recordAudit`; a missing call is caught in review and by the tests of
  that module, not by the database.
- `AsyncLocalStorage` is part of Node, so this adds no dependency.
