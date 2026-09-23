---
summary: The double-entry ledger — account kinds, cards and invoices, journal entries and postings, sign convention, DB-enforced invariants, and worked examples (card purchase, installments with third parties, invoice payment, refund, transfer, reversal).
read_when: Anything that records, edits, reverses or reports money movements, cards or invoices.
updated: 2026-09-22
---

# Ledger (double-entry)

Why double-entry: `../../decisions/0013-double-entry-ledger.md`.
Invoice and installment date rules: `../billing-and-installments.md`.

## Core idea
Every money movement is a **journal entry** made of two or more **postings**. The postings of an
entry **always sum to zero**: money leaves one place and arrives in another. Balances, invoice
totals, what a contact owes, and spending per category are all sums of postings.

The UI and the agent never mention debits and credits. The user says "gastei 87,50 no mercado no
cartão X" and a service builds the postings.

## Sign convention
`postings.amount_cents` is signed and never zero. **Positive = debit, negative = credit.**

| Account class | Increases with | Examples |
|---|---|---|
| `asset` | + | Checking, savings, cash wallet, receivable from a contact |
| `expense` | + | Expense categories |
| `liability` | − | Credit card, loan, payable to a contact |
| `income` | − | Income categories |
| `equity` | − | Opening balances |

The UI shows everything in natural terms (an expense of R$ 50 appears as R$ 50).

## `ledger_accounts`
One table for everything money can sit in or be classified as, including **categories**.
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `parent_id` | FK self null | Tree: "Alimentação › Mercado". A parent must have the same `class`. |
| `kind` | enum `account_kind` | See below. Immutable after the first posting. |
| `class` | enum, **generated** from `kind` | `asset` / `liability` / `income` / `expense` / `equity` |
| `name` | text | Unique among siblings |
| `currency` | char(3) | Default from `workspace_settings` |
| `institution_id` | FK institutions null | Bank/issuer (global seeded list plus custom) |
| `income_nature` | enum `fixed` \| `variable` null | Required when `kind = income_category`, null otherwise (CHECK) |
| `owner_user_id` | FK users null | Informational ("conta do Member A"), not a permission |
| `is_system` | bool | System accounts (receivables, payables, opening balance) can't be renamed or archived |
| `sort_order`, `color`, `icon` | | Personalization |
| `archived_at` | | |

`account_kind` → class:
| kind | class | Notes |
|---|---|---|
| `checking`, `savings`, `cash_wallet`, `investment` | asset | Real places where money sits |
| `receivable` | asset | **One system account per workspace.** The contact goes on the posting. |
| `credit_card` | liability | Has `card_details` and invoices |
| `loan` | liability | |
| `payable` | liability | One system account, for money the household owes a contact |
| `income_category` | income | "Salário" (fixed), "Comissão" (variable)... |
| `expense_category` | expense | The categories |
| `opening_balance` | equity | One system account, used to set initial balances |

## `card_details` (1:1 with a `credit_card` account)
| Column | Notes |
|---|---|
| `account_id` | PK, FK to `ledger_accounts` (CHECK kind = credit_card via a composite FK on `(id, kind)`) |
| `closing_day`, `due_day` | smallint 1–31 |
| `purchase_on_closing_day_goes_next` | bool, default true (per issuer) |
| `limit_cents` | bigint null |
| `holder_user_id` | FK users null |
| `payment_account_id` | FK ledger_accounts null (default account used to pay the invoice) |

## `card_invoices`
| Column | Notes |
|---|---|
| `card_account_id` | FK |
| `reference_month` | `date` (first day of the due month). `unique (card_account_id, reference_month)` |
| `closing_on`, `due_on` | Real dates, copied from the rule at creation. Editable if the issuer moves them. |
| `status` | enum `invoice_status`: `future`, `open`, `closed` |

Invoices are created on demand, `future` ones included, when an installment lands on them.
The amount due and "paid" are **derived** (`invoice_totals` view) from postings with that `invoice_id`.

## `journal_entries` (the lançamento)
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `occurred_on` | date | When it happened (purchase date) |
| `description` | text | "Mercado", "Aluguel outubro" |
| `entry_type` | enum | `expense`, `income`, `card_purchase`, `transfer`, `invoice_payment`, `refund`, `settlement` (contact paid back), `adjustment`, `opening_balance` |
| `payment_method` | enum null | `pix`, `debit`, `credit`, `cash`, `boleto`, `bank_transfer`, `auto_debit`, `other` |
| `installment_count` | smallint ≥ 1 | 1 = paid at once |
| `spent_by_user_id` | FK users null | Who actually spent (vs who recorded it) |
| `source` | enum `entry_source`: `web`, `whatsapp`, `job`, `import` | |
| `created_by_user_id` | FK users | |
| `reversal_of_entry_id` | FK self null | Set on the entry that reverses another. A reversed entry can't be reversed again. |
| `external_ref` | text null | Import dedupe. `unique (workspace_id, external_ref)` |
| `notes` | text null | |

## `postings`
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id`, `entry_id` | | Composite FK to the entry |
| `line_no` | smallint | `unique (entry_id, line_no)` |
| `account_id` + `account_kind` | | **Composite FK `(account_id, account_kind)` → `ledger_accounts(id, kind)`**, so the CHECKs below can use the kind |
| `amount_cents` | bigint `<> 0` | Signed (debit +, credit −) |
| `effective_on` | date | The date this line counts in reports. Default `occurred_on`. For installments, a date in the installment's invoice month. |
| `invoice_id` | FK card_invoices null | |
| `contact_id` | FK contacts null | |
| `installment_no` | smallint null | 1..N |
| `memo` | text null | |

### Invariants enforced by the database
| # | Rule | How |
|---|---|---|
| 1 | Postings of an entry sum to 0 | `DEFERRABLE INITIALLY DEFERRED` constraint trigger at commit |
| 2 | An entry has ≥ 2 postings | Same trigger |
| 3 | `credit_card` posting ⇔ `invoice_id` set, and the invoice belongs to the same card | CHECK on `account_kind` + trigger for the card match |
| 4 | `receivable`/`payable` posting ⇔ `contact_id` set | CHECK on `account_kind` |
| 5 | Nobody posts into an archived account or into a `closed` invoice (except `adjustment`/`invoice_payment`/`refund` entries) | Trigger |
| 6 | All rows share one `workspace_id` | Composite FKs |
| 7 | Posted entries are immutable: no UPDATE of amounts/accounts, no DELETE | Trigger. Corrections happen by reversal |

**Correction policy:** fix by creating a **reversal** (same postings with opposite signs, `reversal_of_entry_id` set) and a new corrected entry. "Undo" in the agent does exactly this. History is never lost, and the audit trail is free.

## Worked examples
Placeholders only: Card X, Member A, Contact J, Contact M.

### 1. Expense by Pix — R$ 87,50 at the grocery store
| Account | Amount |
|---|---|
| Expense: Mercado | +8750 |
| Checking | −8750 |

### 2. Card purchase in 3×, with a third party — TV R$ 1.200,00, Contact J owes R$ 300,00
The card rows are fixed by the issuer (400,00 per installment). Each party's share is allocated across the installments (`../billing-and-installments.md` → multi-party allocation).

| Line | Account | Amount | invoice | contact | inst. | effective_on |
|---|---|---|---|---|---|---|
| 1 | Card X | −40000 | Oct | | 1 | Oct |
| 2 | Card X | −40000 | Nov | | 2 | Nov |
| 3 | Card X | −40000 | Dec | | 3 | Dec |
| 4 | Expense: Eletrônicos | +30000 | | | 1 | Oct |
| 5 | Expense: Eletrônicos | +30000 | | | 2 | Nov |
| 6 | Expense: Eletrônicos | +30000 | | | 3 | Dec |
| 7 | Receivable | +10000 | | J | 1 | Oct |
| 8 | Receivable | +10000 | | J | 2 | Nov |
| 9 | Receivable | +10000 | | J | 3 | Dec |

Sum = 0. Each invoice shows 400. The household's own spending is 300/month. Contact J owes 100/month.
`installment_budget_view = purchase_month` sums the expense by `occurred_on` (900 in the purchase month).
`per_installment` sums it by `effective_on` (300/month). The same data serves both views.

### 3. Several third parties in one entry — dinner R$ 300,00 in 1×, J and M owe R$ 100,00 each
| Account | Amount | contact |
|---|---|---|
| Card X (invoice Oct) | −30000 | |
| Expense: Restaurantes | +10000 | |
| Receivable | +10000 | J |
| Receivable | +10000 | M |

### 4. Contact J pays back R$ 100,00 by Pix, before the invoice is due (`settlement`)
| Account | Amount | contact |
|---|---|---|
| Checking | +10000 | |
| Receivable | −10000 | J |

The invoice is still 300. The money that came in is in the account, and J's balance dropped by 100.

### 5. Paying the invoice — R$ 400,00 (`invoice_payment`)
| Account | Amount | invoice |
|---|---|---|
| Card X | +40000 | Oct |
| Checking | −40000 | |

It's a transfer: no expense is counted twice.

### 6. Moving variable income to the reserve — R$ 1.000,00 (`transfer`)
| Account | Amount |
|---|---|
| Savings: Reserva | +100000 |
| Checking | −100000 |

### 7. Refund of R$ 50,00 on the card (`refund`)
Credit on the **open** invoice, `reversal_of_entry_id` not used (it's a new economic event), linked through `notes`/memo to the original.
| Account | Amount | invoice |
|---|---|---|
| Card X | +5000 | open invoice |
| Expense: (same category) | −5000 | |

### 8. Opening balance — checking starts with R$ 2.000,00
| Account | Amount |
|---|---|
| Checking | +200000 |
| Opening balance (equity) | −200000 |
