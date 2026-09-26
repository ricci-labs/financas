---
summary: Canonical terms. Maps Portuguese words used by the user and the UI to English code names.
read_when: Naming anything, or turning a Portuguese term from the user or a WhatsApp message into code.
updated: 2026-09-26
---

# Glossary

| Portuguese (user / UI) | Code name | Meaning |
|---|---|---|
| espaço, casa | `workspace` | The tenant: an isolated space with its own data. A user can have several. |
| usuário | `user` | A person who logs in. Global. |
| membro | `membership` | A user's participation in a workspace, with a role. |
| lançamento | `journal_entry` (entry) | A money movement. Always ≥ 2 postings summing to zero. **Never call it "transaction"** in code, to avoid confusion with DB transactions. |
| linha do lançamento | `posting` | One signed line of an entry against one ledger account. |
| conta (bancária), carteira, poupança | `ledger_account` of kind `checking` / `cash_wallet` / `savings` | Where money sits. |
| categoria | `ledger_account` of kind `expense_category` / `income_category` | Categories are ledger accounts in a tree. |
| gasto, despesa | `entry_type = expense` / `card_purchase` | |
| receita, entrada | `entry_type = income` | |
| estorno | `entry_type = refund` | Credit back for an earlier purchase. |
| transferência | `entry_type = transfer` | Between the workspace's own accounts. Never spending. |
| pagamento de fatura | `entry_type = invoice_payment` | A transfer from an account to a card invoice. **Never an expense.** |
| apagar, excluir | soft delete (`deleted_at`) | Goes to the trash; restorable. |
| lixeira | trash | Soft-deleted rows, visible with `delete` permission. |
| arquivar | `archived_at` | Hidden from pickers but still counts in history. |
| editar lançamento | replace (`replaces_entry_id`) | Old entry soft-deleted, new one replaces it. |
| papel, perfil de acesso | `role` | A set of module × action permissions. |
| permissão | `role_permission` | `(module, action)`: view, create, update, delete. |
| salário | income category with `income_nature = fixed` | |
| comissão | income category with `income_nature = variable` | |
| renda fixa / variável | `income_nature` | Budgets are sized from `fixed` income by default. |
| cartão | `ledger_account` of kind `credit_card` + `card_details` | |
| fatura | `card_invoice` | One billing period of a card. |
| fechamento | `closing_day` / `closing_on` | The day the invoice stops taking purchases. |
| vencimento | `due_day` / `due_on` | The day the invoice must be paid. |
| melhor dia de compra | (derived) | The closing day. |
| parcela, parcelado | installment (`installment_no`, `installment_count`) | One of N payments of a card purchase. |
| à vista | `installment_count = 1` | |
| limite | `limit_cents` | Card credit limit. |
| terceiro, contato | `contact` | Someone outside the workspace who owes (or is owed) money. |
| a receber | `receivable` (system account) + `contact_id` on the posting | What contacts owe the workspace. |
| cobrança | `charge` | A message asking a contact to pay open items. |
| acerto, pagamento do terceiro | `entry_type = settlement` | A contact paying back. |
| conta fixa, assinatura, boleto recorrente | `recurrence_rule` | A rule that generates expected occurrences. |
| previsto | `planned_occurrence` | An expected bill or income on a date. |
| mês financeiro | financial period (`period_anchor`) | Configurable start (calendar, day N, N-th business day). |
| feriado, dia útil | holiday, business day | Bank holidays: national ones computed, workspace ones stored (`model/planning.md`). |
| competência / caixa | `purchase_month` / cash views | See `billing-and-installments.md`. |
| orçamento | `budget_line` | A category limit valid from a period onward. |
| reserva de emergência, meta | `goal` (+ a savings account) | |
| livre para gastar | `free_to_spend` | Fixed income − spent − committed in the period. |
| comprovante, nota | `file` + `entry_attachments` | |
| lembrete | `notification_outbox` row (`bill_reminder`...) | |
| centavos | `cents` | The only unit money is stored in. |
