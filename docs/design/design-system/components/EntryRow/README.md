---
summary: The EntryRow component: one entry in a list, with category icon, description, account or card, installment and signed amount.
read_when: Building or changing a row in an entry, occurrence or contact list.
updated: 2026-10-01
---

# EntryRow

One entry row in lists: drawn icon, description, category, account or card, installment and signed amount.

**Anatomy:**
- A 44px circle in `sketch-paper` with the category illustration.
- Title in `title-sm`.
- Supporting line in `ink-muted` with the category chip, the account or card, the relative date ("hoje", "ontem") and the installment ("3/10").
- On the right: the Amount `md` and the indicators (paper clip = receipt, people = shared with contacts).
- A `border` divider between rows; minimum height 64px.

**Tap:** the whole row opens the entry, and the touch area is the whole row.

**Variations on the same base:**
- Occurrence row: due date in `danger` when overdue, amount with "≈", and a StatusBadge.
- Contact row: name, amount owed, overdue.

**In shadcn/ui:** a custom component for mobile. On desktop the same information becomes a `Table` row (TanStack Table), as the brief asks. The category chip is a `secondary` `Badge`.
