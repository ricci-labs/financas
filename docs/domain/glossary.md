---
summary: Canonical terms. Maps Portuguese words used by the user and the UI to English code names.
read_when: Naming anything, or turning a Portuguese term from the user or a WhatsApp message into code.
updated: 2026-09-22
---

# Glossary

| Portuguese (user / UI) | Code name | Meaning |
|---|---|---|
| casal, casa | `household` | The single shared budget unit. There is exactly one. |
| pessoa, membro | `member` | One of the two people. Has a WhatsApp number. |
| lançamento | `transaction` | Any money movement being recorded (expense, income, refund, transfer). |
| gasto, despesa | `expense` | `transaction.kind = 'expense'` |
| receita, entrada | `income` | `transaction.kind = 'income'` |
| estorno | `refund` | Money coming back for an earlier expense; linked to it. |
| transferência | `transfer` | Money moving between the household's own accounts/cards. Not spending. |
| pagamento de fatura | `invoice payment` | A `transfer` from an account to a card. **Never an expense** (that would double-count). |
| salário | `salary` | Fixed income source (`incomeSource.type = 'fixed'`). |
| comissão | `commission` | Variable income source (`incomeSource.type = 'commission'`). |
| conta (bancária) | `account` | Checking account, wallet or cash. |
| conta fixa, boleto | `recurringBill` | Expected expense that repeats (rent, internet, subscriptions). |
| cartão | `card` | Credit card. |
| fatura | `invoice` | One billing period of a card. |
| fechamento | `closingDate` / `closingDay` | The date the invoice stops taking new purchases. |
| vencimento | `dueDate` / `dueDay` | The date the invoice must be paid. |
| melhor dia de compra | (derived) | The closing day: purchases from it onward go to the next invoice. |
| parcela, parcelado | `installment` | One of N equal payments of a card purchase. |
| à vista | `installmentCount = 1` | Paid in a single charge. |
| limite | `limitCents` | Card credit limit. |
| categoria | `category` | Spending/income classification; may have a parent. |
| orçamento | `budget` | Planned limit per category per month. |
| competência | `competenceMonth` | The month an expense "belongs to" for budgeting. |
| caixa | `cashMonth` | The month the money actually leaves (for a card: invoice due month). |
| reserva de emergência | `emergencyReserve` | Savings target that commissions fill first. |
| meta | `goal` | Savings target for a specific purpose. |
| centavos | `cents` | The only unit money is stored in. |
