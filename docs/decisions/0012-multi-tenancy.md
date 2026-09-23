---
summary: The app is multi-tenant from day one — users, isolated workspaces, memberships with roles; shared schema with workspace_id, composite FKs and forced Postgres RLS.
read_when: Anything touching tenant isolation, auth, workspaces or queries across tenants.
updated: 2026-09-22
---

# 0012. Multi-tenant from day one (workspaces)

- **Status:** Accepted
- **Date:** 2026-09-22
- **Changes:** the "single household" assumption in the first draft of `../product/vision.md`.

## Context
It starts with one couple, but the user wants the app ready for friends and possibly third parties later: many people, each in private, isolated spaces. A user may create several spaces (e.g. "Casa" and "Pessoal"). Adding tenancy later would mean touching every table and query.

## Decision
- Global `users`; tenant = `workspace`; `memberships` with roles (`owner`, `admin`, `member`, `viewer`). Every member sees everything in their workspace.
- Shared database and schema. Every tenant table has `workspace_id`, `unique (workspace_id, id)`, and **composite FKs**, so cross-tenant references are impossible at the DB level.
- **Forced RLS** on every tenant table, keyed on `app.workspace_id` set with `SET LOCAL` per transaction. Cross-workspace jobs use a dedicated `BYPASSRLS` role, only in `jobs/`.
- Workspaces are fully isolated. A future cross-workspace view is a read-only aggregation over the user's memberships.
- Deleting a workspace hard-deletes all its rows (LGPD erasure).

## Alternatives considered
- Single-tenant, add tenancy later: a painful migration across all tables, queries and tests.
- Schema-per-tenant or database-per-tenant: stronger isolation but heavy migrations and connection costs; unjustified at this scale.
- `workspace_id` column without composite FKs/RLS: isolation would depend only on application code.

## Consequences
- Every query runs inside a transaction with `app.workspace_id` set. The DB helper (`core/db/tx.ts`) does it, and tests assert that RLS blocks cross-tenant reads.
- The agent resolves WhatsApp number → user → workspace (default workspace, switchable).
- Tables have slightly more verbose keys, and composite indexes lead with `workspace_id`.
