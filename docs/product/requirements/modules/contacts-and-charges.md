---
summary: Functional requirements for contacts, what each owes (shares and balances), charges with the pt-BR message and Pix copia e cola, sending by hand, recording payments and cancelling — screens CON-01..05.
read_when: Designing or building contacts, charges or anything showing what third parties owe.
updated: 2026-09-29
---

# Contacts and charges

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Domain:
`../../../domain/model/third-parties.md`. API: `/api/workspaces/:id/contacts`, `/charges`.

## Rules that shape these screens
- **A contact** is someone outside the workspace (friend, relative) who shares purchases. Only the
  name is required: 1–80 characters. Phone in international format (`+5511999990000`, 8–15 digits
  after the "+"), unique among active contacts. Pix key 1–77. Notes up to 500.
- **What a contact owes** comes from shares on expenses and card purchases (`entries.md` →
  Shares). On installment purchases each installment is owed on that invoice's due date, so a
  contact can have amounts overdue and amounts still to come.
- **Balance fields:**
  - "Deve" (`owedCents`): everything still owed, future installments included; negative means the
    contact has credit ("tem crédito");
  - "Em atraso" (`overdueCents`): what was due up to today and is still unpaid; payments count
    against what is due first;
  - "Próximo vencimento" (`nextDueOn`, `nextDueCents`): the next date with something due.
- **Archive** only when the balance is exactly zero (credit included). **Delete** has no balance
  check and no restore: the UI warns when the contact still owes. Opting out ("não quer receber
  mensagens") is recorded and shown; it blocks nothing yet.
- **A charge** gathers the contact's open items up to a date (default today; a later date includes
  upcoming installments) into a fixed pt-BR message, plus a Pix copia e cola when the workspace has
  Pix receiving set up (`SET-02`). The message is written when the charge is created and doesn't
  change later.
- **Charge status** ("Rascunho", "Enviada", "Paga em parte", "Paga", "Cancelada"): paid and
  partially paid come from payments recorded against it. Allowed:
  | Action | Allowed when |
  |---|---|
  | Mark as sent | draft, with no payment yet |
  | Cancel | draft or sent, with no payment yet; its items can be charged again |
  | Record payment | any status except cancelled; partial and over-payment allowed |
- **Sending** is by hand for now: copy the message, or open WhatsApp with it
  (`https://wa.me/<phone>?text=<message>`), then mark it sent. Automatic sending comes with the
  WhatsApp channel.
- **A payment** is a "Recebimento de contato" entry named "Pagamento de cobrança". Deleting that
  entry undoes the payment.

## CON-01 Contacts (MVP)
Route `/contatos`. Permission `contacts:view`. `GET /contacts` + `GET /contacts/balances`.

**RF-CON-1** A list with name, phone, and the balance: "Deve R$ X", "R$ Y em atraso" (danger
style), "Próximo: R$ Z em 10/11", or "Em dia" / "Tem crédito de R$ W". Archived contacts are in a
collapsed "Arquivados" group; opted-out contacts carry a badge "Não quer mensagens".
**RF-CON-2** Sort: "Mais atrasados primeiro" (default), "Nome". A summary on top: "Total a receber"
and "Em atraso".

| Action | Permission | Rule |
|---|---|---|
| "Novo contato" | `contacts:create` | opens `CON-05` |
| Tap a row | `contacts:view` | opens `CON-02` |
| "Cobrar" (row action) | `contacts:create` | shown when the contact owes something due; opens `CON-03` |

Empty: "Nenhum contato ainda. Contatos são pessoas que dividem compras com vocês." + "Novo contato".

## CON-02 Contact detail (MVP)
Route `/contatos/:contactId` (the web finds the contact in the list; there is no single-contact API).

**RF-CON-3** Header: name, phone (tap to call or open WhatsApp), Pix key, notes, balance fields.
**RF-CON-4** "Em aberto": the contact's open items, from their share lines (entries list filtered
by the receivable account and contact, done on the client): date due, description, installment
"2/3", amount, overdue marker. (A dedicated API is in `../api-gaps.md`.)
**RF-CON-5** "Cobranças": the contact's charges (`GET /charges?contactId=`), newest first: date,
total, paid, status badge, due date; tap expands the message and the actions below.

| Action | Permission | Rule |
|---|---|---|
| "Nova cobrança" | `contacts:create` | opens `CON-03`; hidden when nothing is open |
| "Registrar pagamento" (on a charge) | `contacts:update` | opens `CON-04`; hidden on cancelled |
| "Marcar como enviada" | `contacts:update` | only on a draft with no payment |
| "Copiar mensagem", "Enviar pelo WhatsApp", "Copiar Pix" | `contacts:view` | the WhatsApp button needs a phone; opted-out contacts show a warning first: "Este contato pediu para não receber mensagens. Enviar mesmo assim?" |
| "Cancelar cobrança" | `contacts:update` | dialog "Cancelar esta cobrança? Os itens dela poderão ser cobrados de novo." |
| "Anexar comprovante" (on a charge) | `attachments:create` | `ATT-01` |
| "Editar" | `contacts:update` | `CON-05` |
| "Arquivar" / "Desarquivar" | `contacts:update` | archive only with a zero balance; `CONTACT_HAS_BALANCE`: "Só dá para arquivar quando o saldo estiver zerado." |
| "Não quer receber mensagens" | `contacts:update` | switch (`isOptedOut`) |
| "Excluir" | `contacts:delete` | dialog; when the contact owes: "{nome} ainda deve R$ X. Excluir o contato não apaga as dívidas dos lançamentos, mas ele some das listas. Excluir mesmo assim?" |

## CON-03 New charge (MVP)
A sheet from `CON-01`/`CON-02`. `POST /contacts/:contactId/charges`, permission `contacts:create`.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| until | "Cobrar o que vence até" | date, default "Hoje" | yes | valid date; help "Escolha uma data futura para incluir as próximas parcelas." |

**RF-CON-6** Before creating, show a preview of the items that will be included (computed on the
client from the open items up to that date) and the total. Nothing open up to the date disables
"Criar cobrança" with "Nada a cobrar até essa data."
**RF-CON-7** After creating: the message exactly as the contact will read it (from the response),
the Pix copia e cola with "Copiar", and the actions "Enviar pelo WhatsApp" (opens `wa.me` with the
text; then asks "Você enviou a mensagem?" → "Marcar como enviada"), "Copiar mensagem" and "Fechar".
Without Pix receiving set up: a note "Configure sua chave Pix para incluir o Pix copia e cola nas
cobranças." with a link to `SET-02` (`settings:update`).
Errors: `NOTHING_TO_CHARGE` ("Este contato não tem nada em aberto até essa data."),
`CONTACT_NOT_FOUND`, `CHARGE_INVALID`.

## CON-04 Record a payment for a charge (MVP)
A sheet. `POST /charges/:chargeId/payments`, permission `contacts:update`.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| amountCents | "Valor recebido" | money, default what is left of the charge | yes | > 0; above what is left warns "O valor passa do que falta; o excesso fica como crédito do contato." (not blocked) |
| receivedInAccountId | "Recebido em" | money-account picker | yes | active money account |
| occurredOn | "Data" | date, default "Hoje" | yes | valid date |

Action "Registrar pagamento" → toast "Pagamento registrado." and the charge shows its new status.
Errors: `CHARGE_STATUS_REFUSED` ("Esta cobrança foi cancelada e não recebe pagamentos."),
`ACCOUNT_NOT_AVAILABLE` / `NOT_A_MONEY_ACCOUNT` (field account), `CHARGE_PAYMENT_INVALID`,
`CHARGE_NOT_FOUND`.
**RF-CON-8** A payment without a charge (a contact paid something not charged yet) is recorded in
`ENT-02` as "Recebimento de contato".

## CON-05 New or edit contact (MVP)
A dialog. Create `POST /contacts` (`contacts:create`); edit `PATCH /contacts/:id`
(`contacts:update`, only changed fields).

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| name | "Nome" | text | yes | trimmed, 1–80 |
| phoneE164 | "WhatsApp" | phone with country code, default +55 | no | valid international number: "Informe o número com DDD, como (11) 99999-0000."; unique: `CONTACT_PHONE_TAKEN` "Outro contato já usa esse número." |
| pixKey | "Chave Pix" | text | no | 1–77; help "Para você pagar este contato, quando precisar." |
| notes | "Observações" | textarea with counter | no | up to 500 |

Actions "Criar contato" / "Salvar". Errors: `CONTACT_INVALID`, `CONTACT_PHONE_TAKEN` (field),
`CONTACT_NOT_FOUND` (page state).
