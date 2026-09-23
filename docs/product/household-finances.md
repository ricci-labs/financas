---
summary: How the couple's money works (incomes, commissions, cards) and the proposed budgeting policy.
read_when: Touching incomes, commissions, budgets, forecasts or dashboard totals.
updated: 2026-09-22
---

# Household finances

## Incomes
| Member | Income | Nature |
|---|---|---|
| Member A (the user) | Salary | Fixed monthly |
| Member B (partner) | Salary | Fixed monthly |
| Member B (partner) | Sales commissions | Variable in amount and possibly in timing |

All income goes into one shared household budget.

**Open question:** pay days for each salary, and how often commissions are paid (monthly? with the salary? separately?).
**Open question:** is any income kept personal, or is 100% pooled?

## Spending habits
- Most spending is on **credit cards**, which makes invoices, closing days and installments central to the domain (see `../domain/billing-and-installments.md`).
- Pix/debit, cash and bills are secondary.

**Open question:** which cards and banks, who holds each card, and each card's closing and due days.
**Open question:** whether they already have a category list or we define one.

## Budgeting policy (proposal, to be confirmed by the couple)
The goal is that a weak commission month never breaks the budget.

1. **The monthly budget is sized from fixed income only** (sum of both salaries).
2. **Commission counts as extra income.** When it arrives, it is split by a priority waterfall that the couple configures, for example:
   1. Top up the emergency reserve up to its target.
   2. Pay down debt or cover budget overruns from the current month.
   3. Goals (travel, purchases).
   4. Free leisure money.
3. The dashboard shows the **commission average (e.g. last 6 months)** to inform plans, but never counts it as guaranteed income in the budget.

Why: planning on variable income leads to spending on money that may not come. Planning on fixed income and allocating extras on purpose is a common, robust household practice.

## Forecast ("how much can we still spend?")
Computed per financial period by the `period_overview` view (`../domain/model/planning.md`):
`free_to_spend = fixed income − spent − committed`. The financial period start is configurable
(calendar month, day N, or N-th business day).

## Needs raised by the user (2026-09-22)
- Today there is no control, only a rough idea from looking at the card invoice and the account statement.
- Spend only the fixed income and save the variable part (commission) into a savings account.
- Know during the month what was already spent, plus projections.
- Forecast of fixed items: bills and recurring card charges; installments.
- Reminders before due dates, to avoid late fees.
- Cards lent to other people: several people per purchase, also in installments; their part must not pollute own spending; charge them over WhatsApp; record when they pay; attach receipts.
- Accounts, cash, cards, inflows and outflows all in one place.
- Later: metrics, alerts, and other automations built on this data.
