---
summary: Rules for card invoices (closing/due), installment splitting, multi-party allocation, refunds, and competence vs cash views — with worked examples that double as test cases.
read_when: Any code or question involving card invoices, installments, refunds, competence month or cash month.
updated: 2026-09-25
---

# Billing cycle and installments

Implemented as pure functions in `packages/shared/src/cards/billing-cycle.ts` and
`packages/shared/src/installments/installments.ts`. Every example below exists as a unit test next to them.

## Invoice assignment

Each card has `closing_day` and `due_day` (`model/ledger.md` → `card_details`).

Rules:
1. A purchase made **before** the closing date goes to the invoice that closes on that date.
2. A purchase made **on** the closing date goes to the next invoice when `card_details.purchase_on_closing_day_goes_next` is true (the default, matching most Brazilian issuers). Otherwise it goes to the invoice that closes that day.
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

## Invoice status
`invoiceStatusOn()` in `packages/shared/src/cards/billing-cycle.ts`. "Today" is the calendar day in
the workspace time zone (`todayIn()`).

1. **Closed** once its stored `closing_on` has passed. On the closing day itself it is already closed
   when `purchase_on_closing_day_goes_next` is true (that day's purchases go to the next invoice).
   Closed is final: statuses are recomputed only for invoices that aren't closed.
2. **Open** while purchases still land on it: its reference month is at most the one of the invoice
   a purchase made today would go to.
3. **Future** after that (installments already placed on it).

Card X (`closingDay = 3`, `dueDay = 10`), invoices of October (closes 10-03) and November:

| Today | October | November |
|---|---|---|
| 2026-09-15 | open | future |
| 2026-10-03 | closed | open |
| 2026-10-03, issuer keeps closing-day purchases | open | open |

Statuses are refreshed whenever an entry touches the card (a daily job comes later).

## Installment split

1. `base = floor(amountCents / n)`, `remainder = amountCents - base * n`.
2. **Installment 1 takes `base + remainder`**; the rest take `base`. Brazilian issuers usually load the rounding difference on the first installment.
3. Installment 1 goes to the invoice of the purchase date. Installment k goes to the invoice k−1 months later, on the same card.
4. The installment amount is fixed at purchase time. The MVP doesn't model interest ("parcelado com juros"); the total entered is the total charged.
5. Each installment's postings are effective on its invoice's **due date** (`effective_on`), so the per-installment view counts it in the month it is paid.
6. At most 48 installments (`MAX_INSTALLMENTS`), and never more installments than cents.

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

## Multi-party allocation
When an installment purchase is shared (the household's own share plus one or more contacts), the
amounts form a grid. **Rows** are the installments, fixed by the issuer (split rule above).
**Columns** are the parties, with totals fixed by the user. Algorithm (`installments.ts`):

1. For each installment `i < n`: each party gets `floor(c_i × s_p / T)`. Leftover cents in the row go one by one to the parties with the largest fractional part (ties: own share first, then contacts in input order).
2. Last installment: each party gets `s_p − Σ(previous cells)`. The row then sums to `c_n` automatically.
3. Cells equal to 0 produce no posting line.

Where `c_i` = installment amount, `s_p` = party total, `T` = purchase total.

### Examples
TV R$ 1.200,00 in 3×, Contact J owes R$ 300,00 (the clean case; ledger example 2):

| # | Card | Own | J |
|---|---|---|---|
| 1 | 40000 | 30000 | 10000 |
| 2 | 40000 | 30000 | 10000 |
| 3 | 40000 | 30000 | 10000 |

R$ 1.000,00 in 3×, Contact J owes R$ 500,00 (rounding case):

| # | Card | Own | J | Note |
|---|---|---|---|---|
| 1 | 33334 | 16667 | 16667 | exact |
| 2 | 33333 | 16667 | 16666 | 1 leftover cent, tie → own first |
| 3 | 33333 | 16666 | 16667 | last row absorbs the residuals |
| Σ | 100000 | 50000 | 50000 | |

## Refunds
- A refund is a `refund` entry crediting the card on the **current open invoice** and reducing the same expense category (`model/ledger.md`, example 7).
- If the original purchase had contact shares, the refund reduces them proportionally (reverse receivable lines), using the same allocation rule.
- **Open question:** a refund of an installment purchase. Banks either credit everything at once or cancel the future installments. MVP proposal: credit the full amount on the open invoice and leave future installments alone. Revisit when a real case shows up.

## Competence month vs cash month
Every posting stores `effective_on`. For card installments it falls in the installment's invoice month.

| View | Groups by | Used for |
|---|---|---|
| Competence (`purchase_month`) | `journal_entries.occurred_on` | "What did we buy this month?" |
| Per installment (`per_installment`) | `postings.effective_on` | Monthly burden; the default budget view |
| Cash | Card postings: `invoice.due_on`; others: `effective_on` | "Does the money close this month?", forecasts |

The budget view is a **workspace setting** (`installment_budget_view`, default `per_installment`).
Both views read the same stored data, so switching restates nothing. Future installment
commitments are always shown in their own dashboard block, so big purchases stay visible.
