---
summary: The StatusBadge component: the pill badge for the status of a bill, invoice, charge or occurrence, and its token mapping.
read_when: Showing a payment status, or adding or changing a StatusBadge variant.
updated: 2026-10-01
---

# StatusBadge

A pill badge with the status of a bill, invoice, charge or occurrence.

Always with the word (never color alone) and a dot in the tone color. Mapping:
- "Pendente" (pending) → `status-pending`
- "Vencido" (overdue) → `status-overdue`
- "Pago" (paid) → `status-paid`
- "Pago em parte" (partly paid) → `status-partial`
- "Conciliado" (matched) → `status-matched`
- "Cancelado"/"Ignorado" (canceled/ignored) → `status-neutral`

The background is always the matching `*-soft` variant.

**What the screen provides:** the status from the API. The text is fixed per status.

**In shadcn/ui:** `Badge` with one variant per status (`pending`, `overdue`, `paid`, `partial`, `matched`, `neutral`).
