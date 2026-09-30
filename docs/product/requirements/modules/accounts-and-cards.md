---
summary: Functional requirements for accounts, categories, balances, cards and invoices — screens ACC-01..04 and CARD-01..04, with fields, actions, states, rules and errors.
read_when: Designing or building accounts, categories, cards or invoice screens.
updated: 2026-09-29
---

# Accounts and cards

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Domain:
`../../../domain/model/ledger.md`, `../../../domain/billing-and-installments.md`. API:
`/api/workspaces/:id/accounts`, `/cards`, `/balances`.

## Rules that shape these screens
- **Account kinds** (the user creates the money kinds and categories; loans are hidden for now):
  | Kind | Label | Group |
  |---|---|---|
  | `checking` | "Conta corrente" | Money |
  | `savings` | "Poupança" | Money |
  | `cash_wallet` | "Carteira (dinheiro)" | Money |
  | `investment` | "Investimento" | Money |
  | `loan` | "Empréstimo" | Debts. Not offered in the UI yet: no entry type moves money in or out of it (`../api-gaps.md` G15) |
  | `expense_category` | "Categoria de despesa" | Categories |
  | `income_category` | "Categoria de receita", with nature "Renda fixa" (salário) or "Renda variável" (comissão) | Categories |
  | `credit_card` | "Cartão de crédito" | Cards, created only in `CARD-04` |
  | `receivable`, `payable`, `opening_balance` | "A receber", "A pagar", "Saldo inicial" | System, one each, created with the workspace |
- **Categories are a tree:** a category can have a parent of the same class (expense under
  expense, income under income), with no depth limit. Shown as "Mercado › Feira".
- **Names:** 1 to 80 characters, unique without case among siblings (same parent and class).
- **Archived** ("arquivada") accounts still count in history and balances but can't receive new
  entries; pickers hide them. **Deleted** ones go to the trash and are only allowed when no active
  entry uses them and they have no active children ("arquive em vez de excluir").
- **System accounts** can only get colour, icon and order; rename, move, archive and delete are
  hidden for them.
- **A card** is an account plus its cycle. Name, colour, archive and delete go through the account
  routes (`accounts:*`); the cycle through the card routes (`cards:*`). A member can edit a card's
  cycle but not rename or archive it.
- **Which invoice a purchase goes to** (show it live in forms): before the closing day → this
  month's invoice; after → next; on the closing day → next when "Compras no dia do fechamento vão
  para a próxima fatura" is on (default). Due date: same month when the due day is after the
  closing day, else the next month. A day beyond the month's length becomes its last day.
- **Invoice status:** "Futura" (only installments so far), "Aberta" (receives purchases now),
  "Fechada" (final). The stored status can be stale (`../api-gaps.md`), so the web computes it
  with the shared `invoiceStatusOn` for display.
- **Own vs fronted:** each invoice total splits into "Seu" (own) and "De terceiros" (what contacts
  owe, from shares).
- **Balances** are all-time; a card's balance includes future installments ("total em aberto no
  cartão").

## ACC-01 Accounts and balances (MVP)
Route `/contas`. Permission `accounts:view`.

**RF-ACC-1** List money accounts, cards and debts with their current balance
(`naturalBalanceCents`), grouped: "Dinheiro" (checking, savings, wallet, investment), "Cartões",
"Dívidas", and a total of money. Archived accounts go in a collapsed "Arquivadas" group.
**RF-ACC-2** Tapping an account opens `ENT-01` filtered by it.

| Action | Permission | Rule |
|---|---|---|
| "Nova conta" | `accounts:create` | opens `ACC-03` |
| "Editar" (menu) | `accounts:update` | not on system accounts except colour/icon/order |
| "Arquivar" / "Desarquivar" | `accounts:update` | hidden on system accounts; toast with "Desfazer" |
| "Excluir" | `accounts:delete` | hidden on system accounts; `ACCOUNT_CANNOT_BE_DELETED` shows "Esta conta tem lançamentos ou subcategorias. Arquive em vez de excluir." with "Arquivar" |
| "Lixeira" | `accounts:delete` | opens `ACC-04` |
| "Saldo inicial" | `entries:create` | opens `ENT-02` with type opening balance and this account |

States: loading skeleton rows; empty "Nenhuma conta ainda. Comece pela sua conta corrente." +
"Nova conta"; error with retry.

## ACC-02 Categories (MVP)
Route `/categorias`. Permission `accounts:view`.

**RF-ACC-3** Two tabs, "Despesas" and "Receitas", each a tree with colour and icon; the income tab
shows the nature badge ("Fixa" / "Variável"). Total spent/received per category is not shown here
(it belongs to `HOME-01` for a period).
**RF-ACC-4** Actions as in `ACC-01` (new, edit, archive, delete), plus "Nova subcategoria" on a
category. Reordering by `sortOrder` (Later).

## ACC-03 New or edit account or category (MVP)
A dialog or sheet. Create: `POST /accounts`, permission `accounts:create`. Edit: `PATCH
/accounts/:id`, permission `accounts:update`.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| kind | "Tipo" | select: the four money kinds, "Categoria de despesa", "Categoria de receita" | yes (create only; can't change later) | shows "O tipo não pode ser mudado depois." |
| name | "Nome" | text | yes | trimmed, 1–80; unique among siblings |
| incomeNature | "Natureza da receita" | radio "Renda fixa (ex.: salário)" / "Renda variável (ex.: comissão)" | only for income category (create) | help: "O orçamento usa a renda fixa." |
| parentId | "Dentro de" | category picker of the same class; "Nenhuma (principal)" | no | only for categories; can't be itself or a descendant |
| ownerUserId | "De quem é" | member picker, "Da casa" = none | no | informational |
| color | "Cor" | palette | no | `#RRGGBB` |
| icon | "Ícone" | icon picker | no | 1–40 |

Actions: "Criar conta" / "Criar categoria" (create) or "Salvar" (edit; enabled when something
changed). Errors: `ACCOUNT_NAME_TAKEN` (field name: "Já existe uma conta com esse nome aqui."),
`PARENT_NOT_AVAILABLE`, `PARENT_OF_ANOTHER_CLASS` (field parent), `ACCOUNT_CHANGE_REFUSED` (form:
"Essa mudança não é permitida: uma categoria não pode ficar dentro dela mesma, e contas do sistema
não mudam de nome."), `ACCOUNT_DELETED`, `ACCOUNT_INVALID`.
**RF-ACC-5** After creating a money account, offer "Informar saldo inicial" (opens `ENT-02` as
opening balance).

## ACC-04 Accounts trash (MVP)
Route `/contas/lixeira`. Permission `accounts:delete`. Lists deleted accounts, cards included:
name, kind, "Excluída em {data} por {nome}", reason.
Action "Restaurar" → toast "Conta restaurada."; errors `ACCOUNT_NAME_TAKEN` ("Já existe outra
conta com esse nome. Renomeie a outra e tente de novo."), `ACCOUNT_CANNOT_BE_RESTORED` ("A conta
mãe está na lixeira. Restaure ela primeiro."). Empty: "A lixeira está vazia."

## CARD-01 Cards (MVP)
Route `/cartoes`. Permission `cards:view`.

**RF-CARD-1** One card per row: name, colour, "Fecha dia {closingDay} · vence dia {dueDay}", the
current open invoice total and due date, the limit when set (with how much of it the open balance
uses), and the "melhor dia de compra" (the closing day).
Actions: "Novo cartão" (`cards:create`) → `CARD-04`; tap → `CARD-02`; menu "Editar ciclo"
(`cards:update`), "Renomear" / "Arquivar" / "Excluir" (`accounts:update` / `accounts:delete`).
Empty: "Nenhum cartão cadastrado." + "Novo cartão".

## CARD-02 Invoices of a card (MVP)
Route `/cartoes/:cardId`. Permission `cards:view`. `GET /cards/:id/invoices`.

**RF-CARD-2** A list or month strip of invoices ("Fatura de outubro"), each with status badge,
"Fecha {closingOn}", "Vence {dueOn}", total, paid, "Falta pagar" (due), and the split "Seu" /
"De terceiros". The current open one is selected by default; future invoices show the installments
already placed on them.
**RF-CARD-3** "Pagar fatura" on an invoice with something due (`entries:create`) opens `ENT-02` as an
invoice payment, prefilled with the card, invoice, due amount and the card's payment account.
Hidden when the card is archived (it can't be paid: `../api-gaps.md`).

## CARD-03 Invoice detail (MVP)
Route `/cartoes/:cardId/faturas/:invoiceId`. `GET …/invoices/:invoiceId/lines`.

**RF-CARD-4** Header: status, closing and due dates, total, paid, due, own vs fronted. Lines ordered
by date: date, description, installment "3/10", amount; payments shown negative ("Pagamento");
lines with a fronted part show "R$ 30,00 de terceiros". Tap a line → `ENT-03`.
**RF-CARD-5** Filters (client side): "Todas", "Só minhas", "Com terceiros".
**RF-CARD-6** "Pagar fatura" as in `CARD-02`. Closed invoices show a note: "Fatura fechada.
Lançamentos dela não podem ser excluídos nem editados."
Errors: `INVOICE_NOT_FOUND` ("Fatura não encontrada.") as the page state.

## CARD-04 New or edit card (MVP)
Create `POST /cards` (`cards:create`); edit cycle `PATCH /cards/:id` (`cards:update`); name and
colour on edit go through `PATCH /accounts/:id` (`accounts:update`).

| Field | Label | Input | Required | Rules / help |
|---|---|---|---|---|
| name | "Nome do cartão" | text | yes | 1–80; e.g. "Card X" |
| closingDay | "Dia do fechamento" | day picker 1–31 | yes | "Se o mês tiver menos dias, vale o último dia." |
| dueDay | "Dia do vencimento" | day picker 1–31 | yes | preview: "Compras até dia 2 entram na fatura que vence dia 10." |
| purchaseOnClosingDayGoesNext | "Compras no dia do fechamento vão para a próxima fatura" | switch | — | default on |
| limitCents | "Limite" | money | no | > 0 |
| paymentAccountId | "Conta que paga a fatura" | money-account picker | no | active money account; used as default in "Pagar fatura" |
| holderUserId | "Titular" | member picker | no | informational |
| color | "Cor" | palette | no | |

**RF-CARD-7** A live preview under the days: "Uma compra hoje entra na fatura que vence em
{dd/mm}."
**RF-CARD-8** Editing the days warns: "Faturas já criadas mantêm as datas atuais; a mudança vale
para as próximas."
Actions: "Criar cartão" / "Salvar". Errors: `CARD_INVALID`, `PAYMENT_ACCOUNT_NOT_AVAILABLE` (field
payment account: "Escolha uma conta ativa de dinheiro."), `ACCOUNT_NAME_TAKEN` (field name),
`CARD_NOT_FOUND` (page state).
