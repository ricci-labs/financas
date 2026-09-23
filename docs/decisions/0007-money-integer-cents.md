---
summary: All money is stored and computed as integer cents; parsing, formatting and splitting only through shared/domain helpers.
read_when: Handling any monetary value.
updated: 2026-09-22
---

# 0007. Money as integer cents

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
Floating point can't represent most decimal amounts exactly (`0.1 + 0.2 !== 0.3`). Postgres `numeric` comes back as a string in JS, which invites mistakes. Installment splitting needs exact remainders.

## Decision
Every amount is an integer number of cents (`amountCents`) in the DB, the API, the web and tool I/O. Currency is always BRL.

## Alternatives considered
- `numeric(12,2)` + decimal.js: correct, but adds a dependency and conversions everywhere.
- Floats: wrong.

## Consequences
- Parse and format only through `packages/shared/src/domain/money.ts`.
- The UI converts at the edges (input masks, display).
- Multi-currency would need a new ADR.
