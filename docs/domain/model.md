---
summary: Draft entity model — entities, key fields, relationships and invariants. Not yet implemented.
read_when: Creating or changing tables, entities, relationships or service-level validations.
updated: 2026-09-22
---

# Domain model (draft)

Status: draft. Some blocking questions are still open (see `../product/roadmap.md`). The Drizzle
schema in `apps/api/src/modules/*/*.table.ts` becomes the source of truth once it exists; this
file then keeps only the relationships, invariants and their reasons.

## Entities

| Entity | Module | Key fields |
|---|---|---|
| `household` | household | `id`, `name`, `timezone` (`America/Sao_Paulo`) |
| `member` | household | `id`, `householdId`, `name`, `whatsappJid` (unique), `role` |
| `account` | accounts | `id`, `name`, `type` (`checking` \| `wallet` \| `cash`), `ownerMemberId?` |
| `card` | cards | `id`, `name`, `holderMemberId`, `closingDay` (1–31), `dueDay` (1–31), `limitCents?`, `paymentAccountId?`, `archivedAt?` |
| `invoice` | cards | `id`, `cardId`, `referenceMonth` (= due month, `YYYY-MM`), `closingDate`, `dueDate`, `status` (`open` \| `closed` \| `paid`) |
| `transaction` | transactions | `id`, `kind` (`expense` \| `income` \| `refund` \| `transfer`), `amountCents` (> 0), `occurredOn` (date), `description`, `categoryId?`, `memberId`, `method` (`card` \| `account` \| `cash`), `cardId?`, `accountId?`, `installmentCount` (≥ 1), `refundOfId?`, `source` (`web` \| `whatsapp` \| `job` \| `import`), `createdByMemberId`, `deletedAt?` |
| `installment` | transactions | `id`, `transactionId`, `number` (1..N), `amountCents`, `invoiceId` |
| `category` | categories | `id`, `name`, `parentId?`, `kind` (`expense` \| `income`), `archivedAt?` |
| `budget` | budgets | `id`, `month` (`YYYY-MM`), `categoryId`, `limitCents` |
| `incomeSource` | incomes | `id`, `memberId`, `type` (`fixed` \| `commission`), `name`, `expectedCents?`, `payDay?` |
| `recurringBill` | recurring | `id`, `description`, `amountCents`, `dayOfMonth`, `categoryId`, `method`, `cardId?`, `accountId?`, `active` |
| `agentMessage` | agent | Conversation memory per member (role, content, token usage, cost). |
| `pendingAction` | agent | A write proposed by the agent that is waiting for "sim"/"não". |

## Relationships
- `household` 1—N `member`. In practice there is one household and two members.
- `card` 1—N `invoice`; `invoice` 1—N `installment`.
- A card `transaction` 1—N `installment` (N = `installmentCount`). A card purchase paid in one charge still has exactly one installment, so **invoices only ever sum installments**.
- A non-card `transaction` has no installments. It counts in its `occurredOn` month.
- `refund` → `refundOfId` points to the original expense.
- An invoice payment is a `transfer` from `accountId` to `cardId` and marks the invoice `paid`.

## Invariants
1. `amountCents` is a positive integer; `kind` sets the sign. There are no negative amounts in storage.
2. `sum(installment.amountCents) == transaction.amountCents` for every card transaction.
3. `method = 'card'` ⇒ `cardId` is set and installments exist. `method = 'account'` ⇒ `accountId` is set.
4. An invoice with `status = 'paid'` or `'closed'` takes no new installments. A late correction goes to the current open invoice as an adjustment.
5. A `transfer` never counts as spending or income in budgets or reports.
6. Deletes are soft (`deletedAt`). "Undo" in the agent means soft delete plus an audit trail.
7. Every write records `source` and `createdByMemberId`.

**Open question:** whether an account balance is tracked (it needs an opening balance and reconciliation) or only flows are tracked. The MVP proposal is flows only.
