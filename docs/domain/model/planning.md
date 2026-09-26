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

A real entry is **matched** to a pending occurrence so the forecast doesn't count it twice. The
household decided (2026-09-26) that matching is **never automatic**: the app **suggests** and a
member confirms.

- **Fits** (`entryFitsOccurrence`, shared): same entry type as the rule, and the entry moves both the
  rule's source account and its category (or destination) account. Required to confirm a match.
- **Suggested** (`suggestedOccurrences`): fits, the amount on the category is within **5%** of the
  occurrence (**20%** when the rule is an estimate, like energy), and the date is within **10 days**
  of the due date (half a step for rules that repeat faster, e.g. 3.5 days weekly). Closest date
  first, then closest amount.
- A confirmed match sets `matched` + `matched_entry_id`; an entry pays one occurrence at most
  (`ENTRY_ALREADY_MATCHED`). Undoing it puts the occurrence back to `pending`.
- **A match follows its entry** (deferred trigger `planned_occurrences_follow_deleted_entry`, run at
  commit as the owner, scoped to the entry's workspace, ADR 0020). When an entry is edited (replaced),
  the match moves to the new version. When it is deleted, the occurrence goes back to `pending`.
  Restoring the entry later doesn't match it again: a member confirms it, like any match.

## `recurrence_rules`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `description` | text | "Aluguel", "Salário Member A", "Streaming" |
| `entry_type` | enum `recurring_entry_type`: `expense`, `income`, `card_purchase`, `transfer` | Fixed at creation |
| `amount_cents` | bigint > 0 | Expected amount |
| `amount_is_estimate` | bool | True for variable bills (energy) and commission |
| `frequency` | enum `recurrence_frequency`: `weekly`, `monthly`, `yearly` | |
| `interval` | smallint default 1 | Every N weeks/months/years (1–52): quarterly is `monthly` + 3 |
| `day_of_month` | smallint null | 1–31 (missing day → last day of the month) |
| `nth_business_day` | smallint null | Alternative to `day_of_month` (e.g. salary on the 5th business day, 1–10). Never both; neither for `weekly`, which repeats the weekday of `starts_on`. Without either, the day of `starts_on` |
| `weekend_rule` | enum: `keep`, `previous_business_day`, `next_business_day` | Due dates that fall on non-business days |
| `starts_on`, `ends_on` | date, date null | `ends_on` null = open-ended |
| `source_account_id` | composite FK ledger_accounts | Where the money leaves or arrives: a money account (checking, savings, cash, investment), or the card for `card_purchase` |
| `category_account_id` | composite FK ledger_accounts | The expense category (`expense`, `card_purchase`), the income category (`income`), or the destination money account (`transfer`). Never the source |
| `remind_days_before` | smallint null | 0–30. Overrides the member preference |
| `auto_record` | bool default false | Stored now; recording on the due date is phase 2 (auto-debit bills, card subscriptions) |
| soft delete, timestamps | | A rule stops by `ends_on` or by deletion. Contacts get their column with the contacts step |

`recurringAccountsFit(entryType, source, category)` (shared) holds the account rules above; the service
checks it with the accounts that are still usable (not archived nor deleted), else
`400 RECURRENCE_ACCOUNTS_INVALID`. The table repeats the schedule rules as CHECKs.

| Route | Permission | Does |
|---|---|---|
| `GET /recurrences` | `planning:view` | `listRecurrenceRules`: rules not deleted, by description, each with its `schedule` object |
| `POST /recurrences` | `planning:create` | `createRecurrenceRule` `{ description, entryType, amountCents, amountIsEstimate?, sourceAccountId, categoryAccountId, schedule, remindDaysBefore?, autoRecord? }` → `201 { ruleId }` |
| `PATCH /recurrences/:ruleId` | `planning:update` | `changeRecurrenceRule`: only the fields sent (a `schedule` is replaced whole); never `entryType` → `204` |
| `DELETE /recurrences/:ruleId` | `planning:delete` | `deleteRecurrenceRule` (soft, optional `reason`) → `204` |

**Due dates** come from the pure `dueDatesBetween(schedule, { from, to }, holidays)` in
`packages/shared/src/recurrence/`: the nominal date of each step (day clamped to shorter months,
Feb 29 → 28), moved by `weekend_rule`, kept when inside the range and not before `starts_on` nor
after `ends_on`. A date just past the range can move into it (`previous_business_day`), so the
holidays passed must cover the range plus `DAYS_A_DUE_DATE_MAY_SHIFT` (10). The input schema is
`recurrenceScheduleSchema`.

## `planned_occurrences`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id`, `rule_id` | | `rule_id` is a composite FK to `recurrence_rules` (deferred) |
| `due_on` | date | `unique (rule_id, due_on)` |
| `amount_cents` | bigint > 0 | Copied from the rule; editable for this occurrence only |
| `status` | enum `occurrence_status`: `pending`, `matched`, `skipped` | "Overdue" is derived: pending and `due_on` < today |
| `matched_entry_id` | composite FK journal_entries null | Set exactly when `matched` (CHECK); one occurrence per entry |
| timestamps | | No soft delete: occurrences are derived from the rule, and pending ones are rebuilt |

**Planning** (`use-cases/occurrences.ts`), with "today" in the workspace time zone:
- Occurrences exist from today (or `starts_on`, if later) up to the end of the month
  **6 months ahead** (`OCCURRENCE_HORIZON_MONTHS`). The past is never planned.
- Creating a rule plans it. Changing a rule deletes its pending occurrences from today on and plans
  again. Deleting a rule deletes all its pending ones. Matched and skipped ones always stay, and
  overdue pending ones stay on a change.
- A due date is never planned within half a step of any occurrence the rule already has
  (`withoutDatesNearKept`: 15 days for monthly, 3.5 for weekly, scaled by `interval`). So a moved
  day, a new holiday or an unpaid month never gives the same month twice.
- **Reading tops up the horizon:** `listOccurrences` first plans every active rule up to today's
  horizon (idempotent). A cross-workspace job that does the same every night comes with the
  reminders, which need occurrences even when nobody opens the app (it needs the jobs database role,
  ADR 0012).

| Route | Permission | Does |
|---|---|---|
| `GET /occurrences?from&to` | `planning:view` | `listOccurrences`: occurrences due in the range (at most a year), with the rule's description, type, accounts, frequency and `amountIsEstimate`, plus `isOverdue`; by date |
| `GET /occurrences/suggestions?entryId=` | `planning:view` | `suggestOccurrencesForEntry`: pending occurrences the entry probably pays, best first (`404 ENTRY_NOT_FOUND`) |
| `POST /occurrences/:occurrenceId/match` | `planning:update` | `matchOccurrence` `{ entryId }` → `204`. Refused: not pending (`409 OCCURRENCE_NOT_PENDING`), entry gone (`400 ENTRY_NOT_AVAILABLE`), other accounts (`400 OCCURRENCE_ENTRY_MISMATCH`), entry already used (`409 ENTRY_ALREADY_MATCHED`) |
| `POST /occurrences/:occurrenceId/unmatch` | `planning:update` | `unmatchOccurrence` → `204`; `409 OCCURRENCE_NOT_MATCHED` otherwise |
| `POST /occurrences/:occurrenceId/skip` | `planning:update` | `skipOccurrence`: this month doesn't happen (a pending one only, else `409 OCCURRENCE_NOT_PENDING`) → `204` |
| `POST /occurrences/:occurrenceId/unskip` | `planning:update` | `unskipOccurrence`: back to pending (`409 OCCURRENCE_NOT_SKIPPED` otherwise) → `204` |
| `PATCH /occurrences/:occurrenceId` | `planning:update` | `changeOccurrenceAmount` `{ amountCents }` for a pending one (this month's energy bill, a one-off raise). A later change to the rule plans future pending ones again, with the rule's amount |

## Financial period
Driven by `workspace_settings.period_anchor` (`tenancy.md`). Pure function in
`packages/shared/src/calendar/period.ts`:

```
periodOf(date, settings, holidays) → { label: 'YYYY-MM', start: date, end: date }
```
- `calendar_month`: 1st to last day.
- `day_of_month(d)`: starts on day d (or the last day if the month is shorter), ends the day before the next start.
- `nth_business_day(n)`: starts on the n-th business day (weekdays minus holidays, below), ends the day before the next start.
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
| `workspace_id`, `id`, `category_account_id` | Expense category (or a parent, to budget a whole group); composite FK, deferred |
| `limit_cents` | bigint > 0, or null = **no budget from this period on** |
| `valid_from` | `date`, the first day of the period's label month (CHECK). The limit holds until a newer line exists for that category |
| soft delete, timestamps | |

One active line per category and period (partial unique index). "Mercado R$ 1.500 from 2026-10"
stays valid every month until changed; there's no need to recreate budgets monthly. Setting the same
period again replaces its limit.

| Route | Permission | Does |
|---|---|---|
| `GET /budgets?period=YYYY-MM` | `budgets:view` | `listBudgets`: for each category, the latest line on or before that period, unless it stopped the budget → `{ categoryAccountId, limitCents, validFrom: 'YYYY-MM' }[]` |
| `PUT /budgets/:categoryId` | `budgets:update` | `setBudget` `{ limitCents \| null, fromPeriod: 'YYYY-MM' }` → `204`. The category must be a usable expense category (`400 BUDGET_CATEGORY_INVALID`) |

## `goals`
| Column | Notes |
|---|---|
| `workspace_id`, `id`, `name` | Name of 1–80 characters |
| `target_cents` | bigint > 0 |
| `target_on` | date null: when the household wants to get there |
| `account_id` | The money account (checking, savings, cash, investment) that holds it; composite FK, deferred. **Progress = that account's balance**, so one active goal per account |
| `is_reserve` | The emergency reserve (the household policy's first destination for commissions); at most one per workspace |
| soft delete, timestamps | |

| Route | Permission | Does |
|---|---|---|
| `GET /goals` | `planning:view` | `listGoals`: active goals, the reserve first, each with `savedCents` (the account's balance) |
| `POST /goals` | `planning:create` | `createGoal` `{ name, targetCents, targetOn?, accountId, isReserve? }` → `201 { goalId }`. Refused: not a usable money account (`400 GOAL_ACCOUNT_INVALID`), account already holding a goal (`409 GOAL_ACCOUNT_TAKEN`), a second reserve (`409 RESERVE_ALREADY_SET`) |
| `PATCH /goals/:goalId` | `planning:update` | `changeGoal`: only the fields sent, same refusals → `204` |
| `DELETE /goals/:goalId` | `planning:delete` | `deleteGoal` (soft, optional `reason`) → `204`; frees the account |

## Holidays
Business days skip weekends and holidays. They drive `nth_business_day` periods, due dates
(`weekend_rule`) and reminders.

- **National holidays are computed, not stored:** `nationalHolidays(year)` in
  `packages/shared/src/calendar/holidays.ts`. It lists the **bank** holidays, because salaries and due
  dates follow the banks: the fixed national dates (Black Consciousness Day from 2024), Good Friday,
  and Carnival Monday/Tuesday and Corpus Christi (no bank business on those days). Movable dates come
  from `easterSunday(year)`. Each holiday has a `key`; the web shows its pt-BR name. No seeding job.
- **Workspace holidays** (a city holiday, a company day off) go in `workspace_holidays`
  (`workspace_id`, `id`, `on_date`, `name`, soft delete), managed with `planning` permissions.
- `holidayDatesBetween(start, end, workspaceDates)` joins both for the business-day math:
  `isBusinessDay`, `nthBusinessDay`, `shiftToBusinessDay(date, weekendRule)`. Inside a workspace
  transaction, `planning.holidayDatesOf(tx, start, end)` loads the active workspace holidays and
  returns that set.
- One active holiday per day (`workspace_holidays_one_per_day`, deleted ones free the day); a name of
  1–80 characters.

| Route | Permission | Does |
|---|---|---|
| `GET /holidays?year=` | `planning:view` | `listHolidays` → `{ national: { on, key }[], workspace: { id, onDate, name }[] }` of that year |
| `POST /holidays` | `planning:create` | `addHoliday` `{ onDate, name }` → `201 { holidayId }`. A day already taken is `409 HOLIDAY_DATE_TAKEN`; a national holiday is `409 HOLIDAY_ALREADY_NATIONAL` |
| `DELETE /holidays/:holidayId` | `planning:delete` | `deleteHoliday` (soft, optional `reason`) → `204`; gone or unknown is `404 HOLIDAY_NOT_FOUND` |
