---
summary: Functional requirements for entries — list and filters, the new-entry form for every type (expense, card purchase, income, transfer, invoice payment, settlement, opening balance), detail, edit (details or replace), delete, restore and trash.
read_when: Designing or building ENT-01..05, or any shortcut that opens the new-entry form.
updated: 2026-09-29
---

# Entries

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Domain:
`../../../domain/model/ledger.md`, `../../../domain/billing-and-installments.md`. API:
`/api/workspaces/:id/entries`.

## Rules that shape these screens
- **Types the API accepts:**
  | Type | Label | Means |
  |---|---|---|
  | `expense` | "Despesa" | Paid now from a money account (Pix, débito, dinheiro, boleto) |
  | `card_purchase` | "Compra no cartão" | On a credit card, à vista or in installments |
  | `income` | "Receita" | Money in (salário, comissão) |
  | `transfer` | "Transferência" | Between the household's own accounts; never spending |
  | `invoice_payment` | "Pagamento de fatura" | Pays a card invoice; a transfer, never spending |
  | `settlement` | "Recebimento de contato" | A contact paying back what they owe |
  | `opening_balance` | "Saldo inicial" | The starting balance of a money account |
  Refunds ("estorno") and adjustments are not accepted yet (`../api-gaps.md`).
- **Money** is typed in reais and sent as integer cents, always positive (the opening balance may be
  negative: "saldo devedor").
- **Description** 1–200 characters; **notes** up to 2000; **dates** are real calendar days, past or
  future allowed.
- **Payment method** ("Forma de pagamento"): "Pix", "Débito", "Crédito", "Dinheiro", "Boleto",
  "Transferência bancária", "Débito automático", "Outro". A card purchase defaults to "Crédito".
- **"Quem gastou"** must be an active member.
- **Pickers** show only active (not archived) accounts of the right kind.
- **Installments:** 1 to 48, and never more than the amount in cents. The first installment takes
  the rounding cents (R$ 1.000,00 in 3× = 333,34 + 333,33 + 333,33). Installment k goes k−1 invoices
  after the first. A purchase already in progress is recorded "a partir da parcela N": the amount
  is still the full purchase total.
- **Shares** ("Dividir com contatos"): up to 10 contacts, each at most once, amounts > 0, summing to
  at most the total; the rest is "Sua parte". On a card purchase the shares are spread across the
  installments.
- **Closed invoices:** a card purchase can't place an installment on a closed invoice (the API says
  from which installment it could start). An entry with any line on a closed invoice can't be
  deleted, edited (replaced) or restored; only its description and notes change.
- **Editing:** description and notes change in place. Anything else (amount, date, accounts, type,
  installments, shares) creates a new version that replaces the old one, which leaves the active
  list; the new entry has a new id.
- **Delete** sends to the trash; restore brings it back, unless it uses a deleted account or touches
  a closed invoice.

## ENT-01 Entries list (MVP)
Route `/lancamentos`. Permission `entries:view`. `GET /entries` (`from`, `to`, `accountId`,
`limit`, `cursor`).

**RF-ENT-1** Newest first, grouped by day ("Hoje", "Ontem", "sex, 25 set"). Row: description,
category (or "Transferência", "Pagamento de fatura"), account or card, installments "10×" and
contact-share icon when present, attachment icon, amount with sign. Day groups show the day's net
(Later).
**RF-ENT-2** Filters: period (default the current financial period; custom range), account or card
(`accountId`), and type (client side). Active filters show as chips with "Limpar".
**RF-ENT-3** Paging: "Carregar mais" or infinite scroll with `nextCursor`, 100 per page.
**RF-ENT-4** Search by description (client side over loaded pages; server search Later).

| Action | Permission | Rule |
|---|---|---|
| "Novo lançamento" (floating) | `entries:create` | opens `ENT-02` |
| Tap a row | `entries:view` | opens `ENT-03` |
| "Lixeira" (menu) | `entries:delete` | opens `ENT-05` |

States: skeleton rows; empty for the period "Nenhum lançamento neste período." + "Novo lançamento";
empty with filters "Nada encontrado com esses filtros." + "Limpar filtros"; error with retry;
`ENTRY_QUERY_INVALID` resets the filters and says "Os filtros eram inválidos e foram limpos."

## ENT-02 New entry (MVP)
A full screen on mobile, a large dialog on desktop. `POST /entries`, permission `entries:create`.
Opened from the floating button, from `CARD-02/03` (invoice payment), `CON-02` (settlement),
`ACC-01/03` (opening balance), `PLAN-03` (pay a planned bill) and `HOME-03` (moving commission),
prefilled accordingly.

**RF-ENT-5** First choose the type (segmented control, the most used first: "Despesa", "Compra no
cartão", "Receita", "Transferência", then "Mais": invoice payment, settlement, opening balance). The
fields below change with the type; values common to all types are kept when switching.

### Fields common to every type
| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| amountCents | "Valor" | money, large, first focus | yes | > 0 ("Informe um valor maior que zero, como 25,90.") |
| description | "Descrição" | text, suggestions from recent descriptions | yes | trimmed, 1–200 |
| occurredOn | "Data" | date, default "Hoje" | yes | valid date |
| paymentMethod | "Forma de pagamento" | select | no | enum above; hidden for transfer, invoice payment, opening balance |
| spentByUserId | "Quem gastou" | member picker, default the current user for expenses | no | active member |
| notes | "Observações" | textarea with counter | no | up to 2000 |

### Despesa (`expense`)
| Field | Label | Required | Rules |
|---|---|---|---|
| paidFromAccountId | "Pago com" | yes | active money account |
| categoryId | "Categoria" | yes | active expense category |
| shares | "Dividir com contatos" | no | see Shares |

### Compra no cartão (`card_purchase`)
| Field | Label | Required | Rules |
|---|---|---|---|
| cardAccountId | "Cartão" | yes | active card with cycle set up |
| categoryId | "Categoria" | yes | active expense category |
| installmentCount | "Parcelas" | yes, default 1 ("À vista") | 1–48 and ≤ amount in cents; shows "3× de R$ 333,34" |
| firstInstallment | "Começar da parcela" (under "Compra já em andamento") | no, default 1 | 1–installments; help "Para registrar uma compra antiga só a partir das parcelas que faltam. O valor continua sendo o total da compra." |
| shares | "Dividir com contatos" | no | see Shares |

**RF-ENT-6** Live preview under the card: "Entra na fatura que vence em {dd/mm}" and, in
installments, the list "1/3 · out · R$ 333,34 · 2/3 · nov …" (computed with the shared billing
rules).
**RF-ENT-7** When the first installment would fall on a closed invoice, say it before submitting:
"A fatura de {mês} já fechou. Registre a partir da parcela {N}." with the action "Começar da
parcela {N}". The same comes back from the API as `INVOICE_CLOSED`.

### Receita (`income`)
| Field | Label | Required | Rules |
|---|---|---|---|
| receivedInAccountId | "Recebido em" | yes | active money account |
| categoryId | "Categoria" | yes | active income category (badge "Fixa" / "Variável") |
When the category is variable income, after saving offer "Ver sugestão de divisão" (`HOME-03`).

### Transferência (`transfer`)
| Field | Label | Required | Rules |
|---|---|---|---|
| fromAccountId | "De" | yes | active money account |
| toAccountId | "Para" | yes | active money account, different from "De" ("Escolha uma conta diferente da de origem.") |

### Pagamento de fatura (`invoice_payment`)
| Field | Label | Required | Rules |
|---|---|---|---|
| cardAccountId | "Cartão" | yes | active card |
| invoiceId | "Fatura" | yes | an invoice of that card (list with status and "falta pagar"); default the oldest with something due |
| paidFromAccountId | "Pago com" | yes when the card has no default payment account | active money account; default the card's |
Amount defaults to the invoice's "falta pagar"; partial payment allowed; paying more than due warns
"O valor é maior que o saldo da fatura." (not blocked).

### Recebimento de contato (`settlement`)
| Field | Label | Required | Rules |
|---|---|---|---|
| contactId | "Contato" | yes | contact picker showing what each owes |
| receivedInAccountId | "Recebido em" | yes | active money account |
Paying more than the contact owes warns (not blocked). Charges record payments through `CON-04`,
which uses this type.

### Saldo inicial (`opening_balance`)
| Field | Label | Required | Rules |
|---|---|---|---|
| accountId | "Conta" | yes | active money account |
| balanceCents | "Saldo" | yes | ≠ 0; a "Negativo (cheque especial)" switch makes it negative |
Replaces "Valor"; description defaults to "Saldo inicial".

### Shares (`shares`, expense and card purchase)
**RF-ENT-8** "Dividir com contatos" adds rows: contact (picker, each once) and amount; quick fills
"Metade" and "Dividir igualmente". A live line shows "Sua parte: R$ X". Errors: a contact twice
("Esse contato já está na divisão."), the sum above the total ("A soma das partes passa do valor
total."), 11th contact blocked with "Até 10 contatos por lançamento." "Novo contato" inside the
picker opens `CON-05` in a dialog.

### Actions and outcome
| Action | Enabled when | Success | Errors |
|---|---|---|---|
| "Salvar lançamento" (primary) | the form is valid for the chosen type (button contract) | toast "Lançamento registrado." with "Ver"; closes, or keeps the form with type, date and accounts for "Salvar e registrar outro" | field-mapped codes below; others as form messages |
| "Salvar e registrar outro" (secondary) | the form is valid | toast, form cleared except type, date and accounts | same |
| "Cancelar" | always | warns if changed | — |

Field-mapped codes: `NOT_A_MONEY_ACCOUNT` and `ACCOUNT_NOT_AVAILABLE` → the account field involved;
`NOT_AN_EXPENSE_CATEGORY`, `NOT_AN_INCOME_CATEGORY` → category; `SAME_ACCOUNT` → "Para";
`NOT_A_CARD`, `CARD_NOT_SET_UP` → card; `TOO_MANY_INSTALLMENTS` → installments;
`FIRST_INSTALLMENT_OUT_OF_RANGE` → first installment; `INVOICE_CLOSED` → the RF-ENT-7 message;
`INVOICE_NOT_FOUND` → invoice; `PAYMENT_ACCOUNT_REQUIRED` → "Pago com"; `CONTACT_TWICE`,
`SHARES_EXCEED_AMOUNT`, `CONTACT_NOT_AVAILABLE` → shares; `SPENT_BY_NOT_A_MEMBER` → "Quem gastou".

## ENT-03 Entry detail (MVP)
Route `/lancamentos/:entryId`. There is no API for one entry (`../api-gaps.md`): the web uses the
entry from the list cache; a direct link with no cache shows "Abra o lançamento pela lista." until
that route exists.

**RF-ENT-9** Shows type, amount, date, description, notes, payment method, who spent, who recorded
and from where ("pelo WhatsApp", "pela web"), and a readable breakdown of the lines ("Saiu de Conta
X", "Categoria Mercado", "Parcela 2/3 na fatura de novembro", "Contact J deve R$ 20,00").
Attachments section (`ATT-01`). "Histórico" link (`AUD-01` filtered by this entry; `audit:view`).
**RF-ENT-10** When the entry has a line on a closed invoice: a note "Parte deste lançamento está em
uma fatura fechada, então ele não pode ser excluído nem ter valores alterados." and the edit and
delete actions are hidden (description and notes stay editable).

| Action | Permission | Rule |
|---|---|---|
| "Editar" | `entries:update` | opens `ENT-04` |
| "Excluir" | `entries:delete` | no dialog; toast "Lançamento movido para a lixeira." with "Desfazer" (calls restore); optional reason in "Excluir com motivo" |
| "Anexar comprovante" | `attachments:create` | see `ATT-01` |

## ENT-04 Edit entry (MVP)
**RF-ENT-11** Two modes, chosen by what changes:
- only description or notes → `PATCH /entries/:id` in place; toast "Lançamento atualizado.";
- anything else → the `ENT-02` form prefilled, submitted with `PUT /entries/:id`; a note on top: "Ao
  salvar, criamos uma nova versão do lançamento e a anterior fica no histórico." The web switches
  to the new id; attachments and a matched planned bill follow it automatically.
Errors: `ENTRY_ALREADY_DELETED` ("Este lançamento foi excluído ou já foi editado por outra
pessoa. Atualize a lista."), `ENTRY_NOT_FOUND`, plus all of `ENT-02`.

## ENT-05 Entries trash (MVP)
Route `/lancamentos/lixeira`. Permission `entries:delete`. `GET /entries/trash`, paged. Old
versions of edited entries don't appear (they are history).

**RF-ENT-12** Rows as in the list, plus "Excluído em {data} por {nome}" and the reason.
Action "Restaurar" → toast "Lançamento restaurado."; `ENTRY_CANNOT_BE_RESTORED` shows "Não dá para
restaurar: ele usa uma conta excluída, está numa fatura fechada, ou já foi substituído por outra
versão." Empty: "A lixeira está vazia."
