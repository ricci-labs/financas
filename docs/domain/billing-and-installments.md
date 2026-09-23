---
summary: Rules for card invoices (closing/due), installment splitting, refunds, and competence vs cash month — with worked examples that double as test cases.
read_when: Any code or question involving card invoices, installments, refunds, competence month or cash month.
updated: 2026-09-22
---

# Billing cycle and installments

Implemented as pure functions in `packages/shared/src/domain/` (`billing-cycle.ts`,
`installments.ts`, `competence.ts`). Every example below must exist as a unit test.

## Invoice assignment

Each card has `closingDay` and `dueDay`.

Rules:
1. A purchase made **before** the closing date goes to the invoice that closes on that date.
2. **Assumption:** a purchase made **on** the closing date goes to the next invoice. Most Brazilian issuers work this way, but it must be checked per bank. If they differ, add a per-card flag.
3. If `closingDay` doesn't exist in a month (e.g. 31 in September), the closing date is the last day of that month. The same applies to `dueDay`.
4. The due date is the first `dueDay` after the closing date. If `dueDay > closingDay`, it's in the same month; otherwise it's in the next month.
5. `invoice.referenceMonth` is the **month of the due date** ("fatura de outubro" = due in October).
6. A due date on a weekend or holiday is not moved in the data. The bank moves it; we only show the nominal date.

### Examples

Card X: `closingDay = 3`, `dueDay = 10`

| Purchase date | Closing | Due | referenceMonth |
|---|---|---|---|
| 2026-09-02 | 2026-09-03 | 2026-09-10 | 2026-09 |
| 2026-09-03 | 2026-10-03 | 2026-10-10 | 2026-10 |
| 2026-09-15 | 2026-10-03 | 2026-10-10 | 2026-10 |

Card Y: `closingDay = 28`, `dueDay = 5` (due falls in the next month)

| Purchase date | Closing | Due | referenceMonth |
|---|---|---|---|
| 2026-09-20 | 2026-09-28 | 2026-10-05 | 2026-10 |
| 2026-09-28 | 2026-10-28 | 2026-11-05 | 2026-11 |

Card Z: `closingDay = 31`, `dueDay = 8`

| Purchase date | Closing | Due | referenceMonth |
|---|---|---|---|
| 2026-09-10 | 2026-09-30 | 2026-10-08 | 2026-10 |
| 2027-02-10 | 2027-02-28 | 2027-03-08 | 2027-03 |

## Installment split

1. `base = floor(amountCents / n)`, `remainder = amountCents - base * n`.
2. **Installment 1 takes `base + remainder`**; the rest take `base`. Brazilian issuers usually load the rounding difference on the first installment.
3. Installment 1 goes to the invoice of the purchase date. Installment k goes to the invoice k−1 months later, on the same card.
4. The installment amount is fixed at purchase time. The MVP doesn't model interest ("parcelado com juros"); the total entered is the total charged.

### Examples

| Total | n | Installments (cents) |
|---|---|---|
| 100000 (R$ 1.000,00) | 3 | 33334, 33333, 33333 |
| 250000 (R$ 2.500,00) | 10 | 25000 × 10 |
| 10000 (R$ 100,00) | 3 | 3334, 3333, 3333 |
| 999 (R$ 9,99) | 1 | 999 |

Card X, purchase 2026-09-15, R$ 1.000,00 in 3×:

| # | Amount | Invoice due |
|---|---|---|
| 1 | 33334 | 2026-10-10 |
| 2 | 33333 | 2026-11-10 |
| 3 | 33333 | 2026-12-10 |

## Refunds
- A refund (`kind = 'refund'`) is a credit on the **current open invoice** of the same card, linked with `refundOfId`.
- **Open question:** a refund of an installment purchase. Banks either credit everything at once or cancel the future installments. MVP proposal: credit the full amount on the open invoice and leave future installments alone. Revisit when the couple hits a real case.

## Competence month vs cash month

| Concept | Definition | Used for |
|---|---|---|
| `competenceMonth` | The month of `occurredOn` (when the purchase happened) | Budget vs spent per category |
| `cashMonth` | Card: `referenceMonth` of the installment's invoice. Otherwise: the month of `occurredOn` | "Does the money close this month?", forecasts |

**Open question (blocking):** how installments count in the **budget**.
- Option A: all of it in the purchase month (`competenceMonth` of the transaction). A 10× TV blows up one month's budget.
- Option B: each installment counts in its own invoice month. The budget reflects the monthly burden, but a big purchase looks small.

Proposal: **B for budgets**, and show future installment commitments as a separate dashboard block so big purchases stay visible. This needs the couple's confirmation before it is implemented.
