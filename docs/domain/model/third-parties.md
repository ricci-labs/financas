---
summary: Contacts (third parties), how their share of entries is recorded (receivable postings, installments, several per entry), charges sent directly over WhatsApp, and settlements.
read_when: Working on contacts, splitting an entry with other people, charges (cobranças) or recording that someone paid back.
updated: 2026-09-22
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
| `name` | text not null | |
| `phone_e164` | text null | Required to send charges over WhatsApp |
| `pix_key` | text null | Only if the household ever pays *them* |
| `notes` | text null | |
| `opted_out_at` | timestamptz null | Contact replied asking not to receive charges. Sending is blocked while set. |
| `archived_at` | | Only when the balance is zero (trigger) |

`unique (workspace_id, phone_e164)` when a phone is set.

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

### `charge_items`: which receivable postings the charge covers
`charge_id`, `posting_id` (a `receivable` posting of the same contact), `amount_cents`.
`unique (posting_id)` among non-cancelled charges: a posting is charged once at a time.

### `charge_payments`: settlements applied to a charge
`charge_id`, `entry_id` (the `settlement` entry), `amount_cents`. Partial payments allowed.
Sum of payments ≤ `charges.amount_cents` (trigger).

## Flows
### Splitting while recording
"Jantar 300 no cartão X, 100 é do J e 100 da M": the service creates the entry with receivable
lines for J and M (ledger example 3). If a contact doesn't exist yet, the agent offers to create
it by name only.

### Installments
Each installment has its own receivable line (ledger example 2), so a monthly charge can include
exactly "parcela 2/3 da TV". Monthly charges group all of a contact's items whose invoice is due
that month.

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
"O J me pagou 100 no pix": a `settlement` entry (ledger example 4) plus a `charge_payments` row
if an open charge exists. The J share on the card invoice becomes the household's own money again:
the invoice total never changed, and the incoming money is in the account.

### Reports
- `contact_balances`: per contact, total owed, overdue and next due.
- The dashboard separates **own spending** (expense postings) from **fronted for others** (receivable postings) on every card invoice.
