---
summary: When code must find which workspace something belongs to before it has a workspace (e.g. accepting an invitation), use a narrow SECURITY DEFINER SQL function that returns only the workspace id, never a broader bypass.
read_when: A flow needs to locate a tenant row before a workspace is set (invitation tokens, WhatsApp sender lookup, public links).
updated: 2026-09-23
---

# 0019. Narrow SECURITY DEFINER lookups for pre-workspace flows

- **Status:** Accepted
- **Date:** 2026-09-23

## Context
RLS hides every tenant row until `app.workspace_id` is set. Some flows start with only a secret (an invitation token, later a WhatsApp number or a public link) and must first find the workspace. The app role can't see the row, correctly.

## Decision
- Write a small SQL function per lookup, owned by `financas_owner` (so RLS doesn't apply to it), declared `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
- It takes the secret (already hashed by the app when it's a token) and **returns only the workspace id**, never the row.
- `REVOKE ALL ... FROM PUBLIC`, then `GRANT EXECUTE` to `financas_app` only.
- The app then continues inside `withWorkspace()` with normal RLS.
- First instance: `invitation_workspace_id(token_hash)`.

## Alternatives considered
- A `BYPASSRLS` role for these flows: far broader than one column of one row.
- Global tables for tokens (no RLS): spreads tenant data into unprotected tables.
- Putting the workspace id in the invite link: it leaks tenant ids and still needs the token check.

## Consequences
- Each pre-workspace flow adds one tiny, reviewable function with a test that the app can't read the row directly.
- A test proves the flow depends on the function (switching it to SECURITY INVOKER breaks acceptance).
