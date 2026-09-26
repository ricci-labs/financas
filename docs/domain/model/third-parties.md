---
summary: Contacts (third parties), how their share of entries is recorded (receivable postings, installments, several per entry), charges sent directly over WhatsApp, and settlements.
read_when: Working on contacts, splitting an entry with other people, charges (cobranças) or recording that someone paid back.
updated: 2026-09-26
---

# Third parties: contacts, charges, settlements

## Concepts
- **Contact:** someone outside the workspace who owes (or is owed) money. Only a name is required.
- **The ledger is the truth for what they owe.** A contact's share of any entry is a `receivable` posting with `contact_id` (`ledger.md`, examples 2–4). Their balance = sum of those postings.
- **One entry can involve several contacts**, and each contact's share can spread over installments.
- **Charge (cobrança):** a message asking a contact to pay a set of their open items. It is a communication and grouping layer on top of the ledger; it never changes balances by itself.
- **Settlement:** a real payment from the contact, recorded as a `settlement` entry (money in, receivable down) and linked to the charge it pays.

## `contacts`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `name` | text not null | 1–80 characters |
| `phone_e164` | text null | `+55…` format (CHECK). Required to send charges over WhatsApp |
| `pix_key` | text null | Only if the household ever pays *them* (≤ 77 characters, the Pix limit) |
| `notes` | text null | ≤ 500 characters |
| `opted_out_at` | timestamptz null | Contact replied asking not to receive charges. Sending is blocked while set. Set again, it keeps the first moment |
| `archived_at` | | `PATCH { isArchived: true }` only when the balance is zero (`409 CONTACT_HAS_BALANCE`) |
| soft delete, timestamps | | |

One active contact per phone (`409 CONTACT_PHONE_TAKEN`); deleting a contact frees its phone.

| Route | Permission | Does |
|---|---|---|
| `GET /contacts` | `contacts:view` | `listContacts`: active contacts by name, with `isOptedOut`, `isArchived` |
| `POST /contacts` | `contacts:create` | `createContact` `{ name, phoneE164?, pixKey?, notes? }` → `201 { contactId }` |
| `GET /contacts/balances` | `contacts:view` | `listContactBalances`: per active contact with postings, `{ contactId, name, owedCents, overdueCents, nextDueOn, nextDueCents }` |
| `PATCH /contacts/:contactId` | `contacts:update` | `changeContact`: only the fields sent, plus `isOptedOut` and `isArchived` → `204` |
| `DELETE /contacts/:contactId` | `contacts:delete` | `deleteContact` (soft, optional `reason`) → `204` |

## `charges`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id`, `contact_id` | | |
| `amount_cents` | bigint > 0 | Sum of the items at creation |
| `due_on` | date null | Usually the invoice due date of the items |
| `status` | enum `charge_status`: `draft`, `sent`, `partially_paid`, `paid`, `cancelled` | `partially_paid`/`paid` derived from `charge_payments` and kept by a trigger |
| `message_text` | text | The exact text sent (audit) |
| `pix_payload` | text null | Pix "copia e cola" with the amount, generated from the **workspace's** receiving key |
| `sent_at`, `last_reminded_at` | timestamptz null | |
| `created_by_user_id` | | |

Implemented notes: `status` starts `draft`; `sent_at` is set whenever the charge left `draft`
(CHECK, cancelled excepted); `due_on` is the latest due date of its items. Charges are never
deleted, only cancelled. `contact_id` is a composite FK (deferred).

### `charge_items`: which receivable postings the charge covers
`charge_id`, `posting_id` (a `receivable` posting of the same contact), `amount_cents` (what was
still open of it). A posting is charged once at a time among open charges (draft, sent, partially
paid). The service guarantees it while holding the contact's row lock, so two charges of a contact
never run together. The FK to `postings` is added in SQL (`0052`), not in the Drizzle schema, so the
`contacts` and `ledger` table files don't import each other.

### `charge_payments`: settlements applied to a charge
`charge_id`, `entry_id` (the `settlement` entry; one charge per entry; FK added in SQL, deferred),
`amount_cents`. Partial payments and paying more than the charge are allowed (the rest becomes the
contact's credit). **`paid` / `partially_paid` are derived, not stored:** a charge's status is
`chargeStatusOf(stored, amount, paid)`, where paid counts only settlements whose entry is still
active. So deleting a settlement puts the charge back where it was, without a trigger. The stored
status keeps the lifecycle: draft, sent, cancelled. A charge with payments can't be cancelled.

## Flows
### Splitting while recording
"Jantar 300 no cartão X, 100 é do J e 100 da M": `expense` and `card_purchase` inputs take
`shares: [{ contactId, amountCents }]` (up to 10). `planPostings` gives the household's own part to
the category and one `receivable` line per contact (ledger example 3). Refusals:
- `SHARES_EXCEED_AMOUNT`: the shares add up to more than the amount;
- `CONTACT_TWICE`: the same contact appears twice;
- `SHARE_NOT_POSITIVE`: a share is zero or negative;
- `CONTACT_NOT_AVAILABLE`: a contact of another workspace, or an unknown one.

A contact may owe it all; then there is no own line. If a contact doesn't exist yet, the agent
offers to create it by name only.

### Installments
Each installment has its own receivable line (ledger example 2), so a monthly charge can include
exactly "parcela 2/3 da TV". The own part and each share are spread over the installments with
`allocateAcrossInstallments` (`../billing-and-installments.md`). A purchase already in progress keeps
the remaining installments of that same split. Monthly charges group all of a contact's items whose invoice is due
that month.

### Building a charge (pure, `packages/shared/src/charges/` and `pix/`)
- **Open items** (`openItems`): a contact's receivable lines, with their payments applied to the
  **oldest items first** (by due date, then posting). Items still open, due up to the chosen date and
  not already in an open charge. Each carries what's left of it.
- **Message** (`chargeMessage`, pt-BR, the exact text is stored on the charge): who asks, one line
  per item (`parcela n/N` when there are installments), the total, the due date and the Pix copia
  e cola, each only when there is one.
- **Pix copia e cola** (`pixCopiaECola`): a static BR Code (EMV) with the amount, the workspace's key,
  receiver name (≤ 25) and city (≤ 15) without accents, the charge as the transaction id, closed by
  its CRC-16/CCITT-FALSE.

### Routes (charges)
| Route | Permission | Does |
|---|---|---|
| `POST /contacts/:contactId/charges` | `contacts:create` | `createCharge` `{ until? }` (default today, workspace time zone): the contact's open items due up to that day → `201 { chargeId }` with the stored message and Pix copia e cola (when the workspace Pix is set). Nothing open is `409 NOTHING_TO_CHARGE` |
| `GET /charges?contactId=` | `contacts:view` | `listCharges`: newest first, with items, `paidCents` and the derived status |
| `POST /charges/:chargeId/sent` | `contacts:update` | `markChargeSent`: draft → sent (also when a member forwards the message by hand) |
| `POST /charges/:chargeId/payments` | `contacts:update` | `payCharge` `{ amountCents, receivedInAccountId, occurredOn }`: records the `settlement` entry and links it → `201 { entryId }`; a cancelled charge is `409 CHARGE_STATUS_REFUSED` |
| `POST /charges/:chargeId/cancel` | `contacts:update` | `cancelCharge`: an open charge without payments → cancelled; its items can be charged again. `409 CHARGE_STATUS_REFUSED` otherwise |

### Sending a charge (direct, via the platform's WhatsApp)
1. The user asks ("cobra o J") or a scheduled monthly charge triggers.
2. The service collects the contact's open items, builds the message (items, total, due date, Pix copia-e-cola) and saves the `charge`.
3. `notification_outbox` sends it to `contacts.phone_e164` through the WhatsApp channel.
4. Reminders repeat by the workspace's settings until the charge is paid or cancelled.

The user chose direct sending and **accepts the ban risk** of messaging numbers that never talked
to the bot. Anti-ban practices are deferred, but these hooks exist from day one:
- all sends go through the outbox queue (rate limited, spaced out);
- a daily per-workspace cap on messages to contacts (setting);
- `opted_out_at`: a contact replying "parar"/"sair" is never messaged again;
- the message identifies who is charging ("Member A pediu para te lembrar...").

### Recording a payment
"O J me pagou 100 no pix": a `settlement` entry `{ entryType: 'settlement', amountCents, contactId,
receivedInAccountId }` (ledger example 4): money into a money account, J's `receivable` down. An
unknown contact is `400 CONTACT_NOT_AVAILABLE`. Paying more than owed leaves the contact with a
credit (negative balance). A `charge_payments` row links it to an open charge (with the charges PR). The J share on the card invoice becomes the household's own money again:
the invoice total never changed, and the incoming money is in the account.

### Reports
- **Contact balances** (pure `contactBalances(postings, today)`, over the contact lines of active
  entries, `ledger.readContactPostings`):
  - owed = the sum of the lines;
  - overdue = what fell due up to today (including today) minus everything paid, never below
    zero. A payment ahead of time counts against what's due;
  - next due = the earliest future date and its total.
- **Own vs fronted on card invoices:** `GET /cards/:cardId/invoices` adds `frontedCents` (the receivable lines of the same entries and installments) and `ownCents` (total − fronted) to each invoice. Each line of `GET …/invoices/:invoiceId/lines` gets its `frontedCents`.
