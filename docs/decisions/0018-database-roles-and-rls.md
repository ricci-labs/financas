---
summary: Postgres 18 with two roles — financas_owner (owns schema, runs migrations) and financas_app (DML only, subject to RLS); tenant scope set per transaction with withWorkspace().
read_when: Touching database roles, connection strings, migrations, RLS policies, or tenant-scoped queries.
updated: 2026-09-23
---

# 0018. Database roles and RLS enforcement

- **Status:** Accepted
- **Date:** 2026-09-23
- **Refines:** 0012 (multi-tenancy), which assumed "forced" RLS.

## Context
Row Level Security doesn't apply to superusers or to roles with `BYPASSRLS`, and applies to table owners only when forced. Isolation must hold even if application code forgets a filter.

## Decision
- **Postgres 18** (native `uuidv7()` for primary keys).
- **`financas_owner`** owns the database, the schema and every table, and runs migrations (`DATABASE_MIGRATION_URL`).
- **`financas_app`** is what the API uses (`DATABASE_URL`): no superuser, no `BYPASSRLS`, no DDL, and only DML through default privileges. Because it isn't the owner, RLS always applies to it, so `FORCE ROW LEVEL SECURITY` isn't needed.
- Tenant policies compare the row's workspace with `app_current_workspace_id()`, which reads the transaction-local setting `app.workspace_id`.
- Tenant queries go through `withWorkspace(db, workspaceId, work)` (`apps/api/src/core/db/tx.ts`), which sets the setting with `set_config(..., true)` inside a transaction. Nothing leaks to the next query on that pooled connection.
- Roles are created by `docker/postgres/init/01-roles.sh`: automatically in dev and CI, and once by hand in production.
- A future `financas_jobs` role with `BYPASSRLS` is added only when a cross-workspace job needs it.

## Alternatives considered
- One role for everything plus forced RLS: migrations and data fixes would also be filtered, and the superuser created by the Docker image would still bypass everything.
- Filtering by `workspace_id` in code only: a single forgotten `where` leaks data between tenants.

## Consequences
- Integration tests connect as `financas_app` and prove isolation. Disabling RLS makes them fail.
- Seeding and cleanup in tests use the owner connection.
- Production setup has one extra manual step (run the roles script with real passwords).
