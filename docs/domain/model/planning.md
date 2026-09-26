---
summary: Planning tables — recurrence rules and planned occurrences (forecast, reminders, matching to real entries), financial period calculation, budgets, goals, holidays — and the dashboard metrics, insights, commission split, balance forecast and purchase simulation built on them.
read_when: Working on projections, fixed bills, salaries/commission forecasts, reminders, budgets, goals, or the financial period.
updated: 2026-09-26
---

# Planning: forecast, periods, budgets, goals

## Planned vs actual
- **Actual** = postings (`ledger.md`).
- **Planned** = `planned_occurrences` generated from `recurrence_rules` (rent, salary, subscriptions, expected commission).
- **Already-known future** = installment postings on future invoices. They are real postings, not planned occurrences.

When a real entry is recorded, the service tries to **match** it to a pending occurrence (same rule/category, amount within tolerance, date within window). A match sets the occurrence to `matched` and links the entry, so the forecast doesn't count it twice.

## `recurrence_rules`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `description` | text | "Aluguel", "Salário Member A", "Streaming" |
| `entry_type` | enum | `expense`, `income`, `card_purchase`, `transfer` |
| `amount_cents` | bigint > 0 | Expected amount |
| `amount_is_estimate` | bool | True for variable bills (energy) and commission |
| `frequency` | enum `recurrence_frequency`: `monthly`, `weekly`, `yearly`, `every_n_months` | |
| `interval` | smallint default 1 | For `every_n_months` |
| `day_of_month` | smallint null | 1–31 (missing day → last day of the month) |
| `nth_business_day` | smallint null | Alternative to `day_of_month` (e.g. salary on the 5th business day) |
| `weekend_rule` | enum: `keep`, `previous_business_day`, `next_business_day` | Due dates that fall on non-business days |
| `starts_on`, `ends_on` | date, date null | `ends_on` null = open-ended |
| `source_account_id` | FK ledger_accounts null | Where the money leaves from or arrives (checking, card) |
| `category_account_id` | FK ledger_accounts null | Expense or income category |
| `contact_id` | FK contacts null | E.g. a monthly charge to a contact |
| `remind_days_before` | smallint null | Overrides the member preference |
| `auto_record` | bool default false | If true, a job records the entry on the due date (auto-debit bills, card subscriptions) |
| `active` | bool | |

## `planned_occurrences`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id`, `rule_id` | | |
| `due_on` | date | `unique (rule_id, due_on)` |
| `amount_cents` | bigint | Copied from the rule; editable for this occurrence only |
| `status` | enum `occurrence_status`: `pending`, `matched`, `skipped` | "Overdue" is derived: pending and `due_on` < today |
| `matched_entry_id` | FK journal_entries null | Required when `matched` (CHECK) |

A job materializes occurrences **6 months ahead** (setting) and on every rule change: future
pending occurrences are regenerated, matched and skipped ones stay.

## Financial period
Driven by `workspace_settings.period_anchor` (`tenancy.md`). Pure function in
`packages/shared/src/calendar/period.ts`:

```
periodOf(date, settings, holidays) → { label: 'YYYY-MM', start: date, end: date }
```
- `calendar_month`: 1st to last day.
- `day_of_month(d)`: starts on day d (or the last day if the month is shorter), ends the day before the next start.
- `nth_business_day(n)`: starts on the n-th business day (weekdays minus `holidays`), ends the day before the next start.
- The label is the month in which the period **starts**.

Every report ("this month") uses the period, never the calendar month directly.

## Dashboard: facts, metrics, insights (ADR 0024)
`reports` loads the **period facts** once (actual postings, pending occurrences, installments on
future invoices, budgets, goals, balances, settings, today). Every number below is a pure function
in `packages/shared/src/metrics/`, and every alert one in `packages/shared/src/insights/`. A new
number or alert is one file, one line in `METRICS` / `INSIGHTS`, and a test.

**Metrics of the period** (installments count per `installment_budget_view`):
```
fixed_income      = fixed-income postings in the period + pending fixed-income occurrences
spent             = expense postings in the period
committed         = pending expense occurrences in the period
                    + card postings due in the period not yet counted
free_to_spend     = fixed_income − spent − committed
daily_allowance   = max(free_to_spend, 0) ÷ days left in the period (today included)
                    (planned items of the remaining days are already out, through `committed`)
budget_pace       = per budget line: spent ÷ limit vs share of the period elapsed
committed_ahead   = for each of the next 6 periods: installments + fixed expense occurrences,
                    in cents and as % of that period's fixed income
next_invoice      = per card: posted on the open invoice + pending recurring card charges before closing
variable_income   = variable-income postings in the period, and its 6-period average (information
                    only: never part of the budget, household policy)
reserve_months    = reserve goal balance ÷ average fixed expenses of the last 3 periods
```

**Insights** (first set): budget line ahead of pace or over its limit; a future period with more than
a configured share of its fixed income committed; a commission arrived and has a suggested split;
the balance forecast goes negative; an occurrence is overdue.

### Commission split (suggested, never automatic)
`income_allocation_steps` holds the household's waterfall, in order. When variable income arrives,
the pure function `splitVariableIncome(amount, steps, goals)` suggests transfers; the members
confirm them (they are recorded as ordinary `transfer` entries). Automatic recording stays in phase 2.

| Column | Notes |
|---|---|
| `workspace_id`, `id`, `position` | `unique (workspace_id, position)` |
| `kind` | enum: `fill_goal` (up to the goal's target), `percent`, `fixed_amount`, `rest` |
| `goal_id` / `account_id` | Where the money goes: a goal (its account) or an account |
| `percent` / `amount_cents` | Set for `percent` / `fixed_amount` only (CHECK) |

### Balance forecast
Per liquid account (checking, savings, cash), day by day from today to the next fixed-income
occurrence landing there (at least to the end of the period): today's balance + pending
occurrences on that account + card invoices due and paid from it. Returns the daily balances and
the lowest point; an insight fires when it goes below zero.

### "Posso comprar?" (purchase simulation)
Read-only. Given an amount, a card (or an account) and an installment count, it plans the postings
with the same functions that record a real purchase (`planPostings`, billing cycle), adds them to
the facts of each affected period, and answers the metrics before and after for each period
(`free_to_spend`, `committed_ahead`). Nothing is written. The agent reuses it.

## `budget_lines`
| Column | Notes |
|---|---|
| `workspace_id`, `id`, `category_account_id` | Expense category (or a parent, to budget a whole group) |
| `limit_cents` | bigint > 0 |
| `valid_from_period` | `date` (period start label). The limit holds until a newer line exists for that category. |

`unique (workspace_id, category_account_id, valid_from_period)`. "Mercado R$ 1.500 from 2026-10"
stays valid every month until changed. There's no need to recreate budgets monthly.

## `goals`
`workspace_id`, `id`, `name`, `target_cents`, `target_on` (date null), `account_id` (the savings
account that holds it; progress = its balance), `archived_at`.

## `holidays`
| Column | Notes |
|---|---|
| `id`, `on_date`, `name` | |
| `scope` | enum: `national`, `workspace` |
| `workspace_id` | null for national (seeded), set for custom ones |

Used for business-day math (periods, due dates, reminders). National ones are seeded yearly by a job.
