---
summary: Constraint triggers that check a cross-row invariant run as financas_owner (SECURITY DEFINER trigger function), so RLS and the current workspace setting can't hide the rows they must see.
read_when: Writing or reviewing a trigger that checks a rule across rows (owner invariant, balanced entries, view-required permissions).
updated: 2026-09-24
---

# 0020. Invariant triggers run as the owner

- **Status:** Accepted
- **Date:** 2026-09-24
- **Refines:** 0018 (database roles and RLS).

## Context
Deferred constraint triggers check rules across rows at commit: a workspace keeps an owner, a role never has an action without `view`, and later the postings of an entry sum to zero. A trigger function runs as the user who fired it, so for the app it runs **under RLS**, filtered by the `app.workspace_id` that is current **at commit**. If the transaction changes that setting after the violating write, the check can't see the rows and passes. This was reproduced: demoting the only owner, then switching workspace in the same transaction, committed.

## Decision
- Trigger functions that check an invariant are `SECURITY DEFINER` with `SET search_path = public, pg_temp`, owned by `financas_owner`. RLS doesn't apply to the owner, so the check sees every row it needs, whatever the session setting.
- The helper they call (`assert_...`) runs as the owner through them. Execute on the helper is revoked from `PUBLIC` and `financas_app`, so it's internal.
- A test for each invariant violates it, switches workspace in the same transaction (`switchWorkspaceMidTransaction()`), and expects the violation.

## Alternatives considered
- Refusing to change `app.workspace_id` twice in a transaction: Postgres has no hook for that, and it would only protect against one way of hiding rows.
- `FORCE ROW LEVEL SECURITY` plus policies for the owner: the check would still depend on the setting.

## Consequences
- These functions only read and raise. Anything that writes stays `SECURITY INVOKER`, under RLS.
- New invariant triggers (the ledger's balanced-entry check) follow the same pattern from the start.
