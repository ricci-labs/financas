---
summary: Soft delete (deleted_at) on every user-facing table with a restorable trash; archive is separate; ledger entries are edited by soft-delete-and-replace; hard delete only for LGPD erasure and trashed-file purge.
read_when: Implementing delete/restore/edit, writing queries that must exclude deleted rows, or changing the correction policy.
updated: 2026-09-22
---

# 0016. Soft delete everywhere; entry edits by replacement

- **Status:** Accepted
- **Date:** 2026-09-22
- **Amends:** 0013 (correction policy: reversal entries → soft delete / replacement).

## Context
The user wants soft delete. Accounting practice (reversal entries) is correct but confusing for users who just want to delete a mistake. Deleting must stay safe: nothing is lost, the ledger stays balanced, and anyone with permission can restore it.

## Decision
- Every user-facing table has `deleted_at`, `deleted_by_user_id` and `delete_reason`. Repositories exclude deleted rows by default, and unique constraints are partial.
- `archived_at` is a different concept: no longer used, but it still counts in history.
- Ledger: postings are immutable. Deleting an entry soft-deletes it as a whole, so the balance holds. Editing money fields soft-deletes the old entry and creates a new one with `replaces_entry_id`. Entries on closed invoices can't be deleted; they're corrected with refund/adjustment entries.
- Restore requires the `delete` permission on the module. Deletes and restores are audit-logged.
- Hard delete only for LGPD erasure of a whole workspace and for purging trashed files after 30 days.

## Alternatives considered
- Reversal entries only: accounting-pure, but users see mirror entries for a simple mistake.
- Hard delete: loses history and makes restore impossible.
- Status columns per table (`status = deleted`): not uniform, and harder to filter by default.

## Consequences
- A `notDeleted()` helper and repository defaults. Tests check that deleted rows never leak into balances or pickers.
- Triggers block soft-deleting rows that active rows depend on (archive instead).
- A trash screen per module for users with `delete`.
