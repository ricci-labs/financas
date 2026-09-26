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

**The facts** (`PeriodFacts`, `metrics/metrics.types.ts`), loaded by `reports.getPeriodOverview`:
today (workspace time zone), the period (from the settings and the holidays), the 6 periods
before and the 6 after it, the budget view and base, the accounts (`ledger.readAccountFacts`), the postings of active entries that fall in the
period by `effective_on` or by the entry's `occurred_on` (`ledger.readPostingFacts`), and the
occurrences due in the period (`planning.readOccurrenceFacts`, which tops up the horizon first),
the budgets in force (`planning.readBudgetFacts`), the reserve (`planning.readReserveFact`), the
cards with their payment account (`ledger.readCardFacts`), the invoices closing from a month ago on
(`ledger.readInvoiceFacts`), the account balances (`ledger.readBalanceFacts`) and the commission
waterfall's destinations. Occurrences also load from a month before today when the period starts
later, so the open invoice's subscriptions are there.
Postings are loaded from the start of the oldest previous period to the end of the last coming
one, and occurrences from the start of the period to that same end. The plan reaches 6 months past
today, so a coming period beyond it only shows what is already posted.

**Metrics of the period** (a posting counts by `effective_on`, or by `occurred_on` under
`installment_budget_view = purchase_month`; amounts in cents):
```
fixed_income      = fixed-income postings in the period + pending income occurrences whose
                    category is fixed
variable_income   = variable-income postings in the period (never an occurrence: it's not
                    guaranteed)
budget_income     = fixed_income, or fixed + variable when budget_base = all_income
spent             = expense postings in the period (refunds reduce it)
committed         = pending expense and card-subscription occurrences due in the period, overdue
                    ones included (installments are already postings, so they are in `spent`)
free_to_spend     = budget_income − spent − committed
daily_allowance   = max(free_to_spend, 0) ÷ days left, today included (the whole period before it
                    starts, null after it ends). Planned items of the remaining days are already
                    out, through `committed`, as the household chose
budget_pace       = per budget in force (`planning.readBudgetFacts`): spent on the category and every
                    category below it; expected = limit × days elapsed ÷ days in the period (today
                    included); `over` past the limit, `ahead` past the expected, else `within`
committed_ahead   = for each of the next 6 periods: installments already posted there (by
                    `effective_on`, whatever the budget view: it's the burden that month) + pending
                    bills and subscriptions, and that total as a whole % of the period's fixed
                    income (null without fixed income)
next_invoice      = per card, the invoice a purchase made today goes to (`invoiceForPurchase`):
                    its total so far + the pending subscriptions of that card whose due date lands
                    on the same invoice → { closingOn, dueOn, postedCents, plannedCents,
                    forecastCents }
variable_average  = variable income averaged over the 6 previous periods that have any posting
                    (a new household isn't averaged with empty months); null without history.
                    Information only: never part of the budget, household policy
reserve_coverage  = the reserve goal's balance and target, the average spending of the last 3
                    previous periods (idle ones left out) and how many months the reserve covers
                    (one decimal); null without a reserve, months null without spending history
```

| Route | Permission | Does |
|---|---|---|
| `GET /overview?period=YYYY-MM` | `reports:view` | `getPeriodOverview`: `{ today, period, metrics, insights }` for the current period, or the period labeled with that month |

**Insights** (`packages/shared/src/insights/`, one rule per file, in `INSIGHTS`): each is
`{ code, severity, subject, values }`. There is no text: the web and the agent write pt-BR from the
`code` and `values`, and notifications will reuse them. Alerts come before warnings, each group in
the order of `INSIGHTS`.

| Code | Severity | Subject | When |
|---|---|---|---|
| `period_overspent` | alert | period label | `free_to_spend` < 0: spending and bills exceed the budget income |
| `budget_over` | alert | category | a budget past its limit |
| `budget_ahead` | warning | category | a budget past its expected pace |
| `occurrence_overdue` | warning | occurrence | a pending bill or income past its due date |
| `period_heavily_committed` | warning | period label | a coming period with ≥ 70% of its fixed income committed (`HEAVILY_COMMITTED_PERCENT`) |
| `variable_income_to_split` | info | period label | with a waterfall configured: the period's commission minus what reached its destination accounts in the period (deposits only, never withdrawals) minus the overrun it covers (when a `cover_overspent` step exists) is still positive → `{ amountCents }` still to split |

| `balance_going_negative` | alert | account | the balance forecast dips below zero → `{ lowestCents, lowestOn }` |
| `contact_overdue` | warning | contact | a contact has items past due (`contacts.readContactBalanceFacts`) → `{ overdueCents, owedCents }` |

### Commission split (suggested, never automatic)
`allocation_steps` holds the household's waterfall, in order. When variable income arrives, the pure
function `splitVariableIncome(amount, steps, { goals, overspentCents })` (`packages/shared/src/allocation/`)
suggests the parts, and the members confirm them as ordinary `transfer` entries. Automatic recording
stays in phase 2. Each step takes what it wants, capped by what is left, and a step with nothing to
take is skipped; what no step takes is `leftoverCents`.

| `kind` | Takes | Goes to |
|---|---|---|
| `fill_goal` | what the goal still lacks (target − its account's balance) | the goal's account |
| `cover_overspent` | the current period's overrun (−free to spend, when negative) | stays where it is (`toAccountId: null`) |
| `percent` | a whole percent (1–100) of the **whole commission** | an account |
| `fixed_amount` | a fixed amount | an account |
| `rest` | everything left; only as the last step | an account |

| Column | Notes |
|---|---|
| `workspace_id`, `id`, `position` | One active step per position (1…) |
| `kind` | enum `allocation_step_kind` |
| `goal_id` / `account_id` | Composite FKs, deferred. `goal_id` exactly for `fill_goal`; `account_id` exactly for `percent`, `fixed_amount`, `rest` (CHECKs). The account must be a usable money account |
| `percent` / `amount_cents` | Exactly for `percent` / `fixed_amount` (CHECKs) |
| soft delete, timestamps | A new waterfall soft-deletes the old steps |

| Route | Permission | Does |
|---|---|---|
| `GET /allocation-steps` | `planning:view` | `listAllocationSteps`, in order |
| `PUT /allocation-steps` | `planning:update` | `replaceAllocationSteps` `{ steps: [...] }` (at most 10; `[]` clears) → `204`. Refused: `ALLOCATION_INVALID`, `ALLOCATION_ACCOUNT_INVALID`, `ALLOCATION_GOAL_INVALID` |
| `GET /allocation/suggestion?amountCents=` | `reports:view` | `reports.suggestAllocation` → `{ parts: [{ position, kind, toAccountId, amountCents }], leftoverCents }` with today's goals and the current period's overrun |

### Balance forecast
Metric `balanceForecast`, per money account (checking, savings, cash, investment), day by day from
today until the next **fixed** income landing on it, or the end of the period if that comes later:
- start = today's balance (the account's balance minus its postings dated after today);
- pending bills, incomes and transfers (both sides) touching the account; overdue ones leave
  **today**. The commission is never counted (household policy);
- card invoices paid from it (`card_details.payment_account_id`) on their due dates: what is still
  due, plus the pending subscriptions that land on the open invoice, even before the invoice has a
  purchase;
- postings dated after today.

→ `{ accountId, until, startCents, endCents, lowestCents, lowestOn, points: [{ on, balanceCents }] }`
(one point per day that moves). The alert `balance_going_negative` (subject = account,
`{ lowestCents, lowestOn }`) fires when the lowest point is below zero.

### "Posso comprar?" (purchase simulation)
Read-only: nothing is written. `simulatePurchase(facts, purchase)` (`packages/shared/src/simulation/`)
adds a hypothetical purchase to the facts and recomputes the same metrics and insights:
- **on a card:** the same invoices a real purchase would get (`invoicesForInstallments`, installments
  from `splitInstallments`), each installment effective on its invoice's due date, added to that
  invoice's total (or a new invoice);
- **from an account** (1×): the expense on its date and the money out of the account (today or later).

→ `{ period: { label, freeToSpend before/after, dailyAllowance before/after }, coming: [{ label,
committed before/after, percentOfIncome before/after }], newInsights }`, where `newInsights` are only
the alerts the purchase would bring (e.g. `period_heavily_committed`, `balance_going_negative`).

| Route | Permission | Does |
|---|---|---|
| `GET /simulations/purchase?amountCents&installmentCount&cardAccountId\|paidFromAccountId&occurredOn` | `reports:view` | `reports.simulatePurchaseImpact` for the current period. A card **or** a money account; installments only on a card (`400 SIMULATION_QUERY_INVALID`); an unknown card or non-money account is `400 SIMULATION_CARD_INVALID` / `SIMULATION_ACCOUNT_INVALID` |

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
