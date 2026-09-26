---
summary: Dashboard numbers and alerts are pure functions over one loaded set of period facts — one file per metric or insight, registered in a list in @financas/shared — so new numbers and alerts are added without touching queries, routes or channels.
read_when: Adding or changing a dashboard number, a forecast, an alert/insight, the period overview, or anything the web, the agent or a reminder shows as a computed figure.
updated: 2026-09-26
---

# 0024. Metrics and insights over period facts

- **Status:** Accepted
- **Date:** 2026-09-26

## Context
- The dashboard is the product's answer to "how much can we still spend?" (vision, goal 2), and
  the user expects to keep adding numbers and alerts as new needs show up.
- The same figures must reach three places that are built at different times: the web, the
  WhatsApp agent and the reminders. If each computes its own, they drift.
- The money math must be deterministic and tested (ADR 0007, vision goal 5). SQL views are hard to
  unit test and to extend one number at a time.

## Decision
- **Period facts, loaded once.** `reports` asks `ledger` and `planning` for everything a period
  needs: actual postings, pending planned occurrences, installments on future invoices, budgets,
  goals, account balances, the settings. Plain data (`PeriodFacts`), no behavior.
- **Metrics are pure functions.** Each dashboard number is one file in
  `packages/shared/src/metrics/`: `(facts) → value`, with its own test. A list (`METRICS`) holds
  them. The overview route returns every metric in the list.
- **Insights are pure functions too.** Each alert is one file in `packages/shared/src/insights/`:
  `(facts, metrics) → Insight[]`, where an insight is `{ code, severity, subject, values }`. No
  text: the web and the agent write pt-BR from `code` + `values`; notifications will send them
  through the outbox. A list (`INSIGHTS`) holds them.
- **Adding something new is one file + one line in a list + a test.** Only a new kind of fact
  touches a query.
- `packages/shared` stays pure (dependency rule 8): "today" arrives inside the facts.

## Alternatives considered
- One SQL view per number (`period_overview` in the first model draft): fast to read, but every
  new number is a migration, and views can't be unit tested or reused by the agent's simulations.
- Compute in the web: the agent and reminders would need a second copy.
- A rules engine or configurable formulas: flexible, but the household doesn't need user-written
  formulas, and it costs type safety.

## Consequences
- A request loads a few more rows than one number needs. Fine at household scale; if a period
  gets heavy, facts can be cached per period without changing any metric.
- Simulations ("posso comprar?") reuse the same metrics on facts with a hypothetical purchase
  added, so the answer matches the dashboard exactly.
- The `period_overview` view in `domain/model/planning.md` is replaced by the `periodOverview`
  metrics.
