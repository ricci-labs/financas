---
summary: All money movements are stored as a double-entry ledger (journal entries + signed postings summing to zero), with categories as ledger accounts and corrections by reversal.
read_when: Questioning how money is stored, adding a new kind of movement, or writing reports.
updated: 2026-09-22
---

# 0013. Double-entry ledger

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** the single-table `transaction` + `installment` draft.
- **Amended by:** 0016 (corrections by soft delete/replace instead of reversal entries).

## Context
The requirements span bank accounts, cash, credit cards with installments, third parties who owe parts of card purchases (several per purchase, across installments), transfers such as paying an invoice or moving income to savings, refunds and projections. A flat "transactions" table needs a special case for each of these and easily double-counts (paying an invoice counted as an expense).

## Decision
- `journal_entries` (the lançamento) with ≥ 2 `postings`; postings are signed (debit +, credit −) and **sum to zero per entry**, enforced by a deferred constraint trigger.
- `ledger_accounts` holds real accounts (checking, savings, cash, cards, loans), system accounts (receivable, payable, opening balance) **and categories** (income/expense accounts in a tree).
- Card installments are postings on future invoices. Third-party shares are `receivable` postings with a `contact_id`.
- Posted entries are immutable. Corrections and "undo" happen by reversal.
- Details and examples: `../domain/model/ledger.md`.

## Alternatives considered
- Flat transactions table with type flags: simpler at first, but every new case (third parties in installments, invoice payment, refunds) adds special logic and the invariants can't be checked by the DB.
- Separate categories table plus a ledger for money: two parallel classification systems. Categories as accounts keep one model.

## Consequences
- Balances, invoice totals, contact balances and category spending are all sums over postings (views).
- The DB guarantees consistency: an entry that doesn't balance can't be committed.
- Services must build postings correctly. That's covered by the example-driven tests in the model docs.
- The UI and the agent never expose debits and credits.
