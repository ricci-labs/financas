---
summary: The double-entry ledger — account kinds, cards and invoices, journal entries and postings, sign convention, DB-enforced invariants, correction policy (soft delete / replace), and worked examples.
read_when: Anything that records, edits, reverses or reports money movements, cards or invoices.
updated: 2026-09-26
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

**Implemented** (module `ledger`). Not yet: `institution_id` (comes with the `institutions` table)
and "kind immutable after the first posting" (comes with `postings`).
Kinds, classes and system account names live in `packages/shared/src/ledger`.
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `id` | | |
| `parent_id` | FK self null | Tree: "Alimentação › Mercado". A parent must have the same `class` (composite FK on `(workspace_id, id, class)`). No cycles, no child under a deleted parent, no soft delete while children are active (triggers). |
| `kind` | enum `account_kind` | See below. Immutable after the first posting. |
| `class` | enum, **generated** from `kind` | `asset` / `liability` / `income` / `expense` / `equity` |
| `name` | text | Unique among siblings of the same class, case-insensitive, among non-deleted |
| `currency` | char(3) | Default from `workspace_settings` |
| `institution_id` | FK institutions null | Bank/issuer (global seeded list plus custom) |
| `income_nature` | enum `fixed` \| `variable` null | Required when `kind = income_category`, null otherwise (CHECK) |
| `owner_user_id` | FK users null | Informational ("conta do Member A"), not a permission |
| `is_system` | bool, **generated** from `kind` | System accounts (receivable, payable, opening balance): one per workspace, at the root, created by `createWorkspace()` in the workspace currency. They can't be renamed, re-kinded, moved, archived or deleted; only personalized (color, icon, order) |
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
**Implemented.** Created with the account by `createCard()`, changed by `changeCard()`. The payment
account must be an active money account (checked by the service).

| Column | Notes |
|---|---|
| `account_id` | PK, FK to `ledger_accounts` (kind = credit_card via a composite FK on `(workspace_id, id, kind)` and a CHECK on `account_kind`) |
| `closing_day`, `due_day` | smallint 1–31 |
| `purchase_on_closing_day_goes_next` | bool, default true (per issuer) |
| `limit_cents` | bigint null |
| `holder_user_id` | FK users null |
| `payment_account_id` | FK ledger_accounts null (default account used to pay the invoice) |

## `card_invoices`
**Implemented.** Created on demand by the card purchase flow, for every installment, with
`ON CONFLICT DO NOTHING` so concurrent purchases share them. Status rules:
`../billing-and-installments.md` → Invoice status.

| Column | Notes |
|---|---|
| `card_account_id` | FK |
| `reference_month` | `date` (first day of the due month, CHECK). `unique (workspace_id, card_account_id, reference_month)` |
| `closing_on`, `due_on` | Real dates, copied from the rule at creation. Editable if the issuer moves them. `due_on > closing_on` |
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
| `spent_by_user_id` | FK users null | Who actually spent (vs who recorded it). An active member when recorded |
| `source` | enum `entry_source`: `web`, `whatsapp`, `job`, `import` | |
| `created_by_user_id` | FK users | |
| `replaces_entry_id` | FK self null | Set when an entry is edited: the old one is soft-deleted and this one replaces it |
| `deleted_at`, `deleted_by_user_id`, `delete_reason` | | Soft delete: the entry and all its postings leave every balance and report |
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
| `invoice_id` | FK card_invoices null | Set exactly on `credit_card` postings; composite FK `(workspace_id, invoice_id, account_id)` → the invoice of that same card |
| `contact_id` | FK contacts null | |
| `installment_no` | smallint null | 1..N |
| `memo` | text null | |

### Invariants enforced by the database
Status: rows marked ✅ are implemented; row 4 comes with contacts.

| # | Rule | How |
|---|---|---|
| 1 ✅ | Postings of an entry sum to 0 | `DEFERRABLE INITIALLY DEFERRED` constraint triggers at commit, on `journal_entries` and `postings` insert, running as the owner (ADR 0020) |
| 2 ✅ | An entry has ≥ 2 postings | Same trigger (an entry with no postings fails too) |
| 3 ✅ | `credit_card` posting ⇔ `invoice_id` set, and the invoice belongs to the same card | CHECK `postings_invoice_exactly_on_cards` + composite FK `postings_invoice_of_the_card_fk` |
| 4 | `receivable`/`payable` posting ⇔ `contact_id` set | CHECK on `account_kind`. **Until then, postings on `receivable`/`payable` are refused** (same CHECK) |
| 5 ✅ | Nobody posts into an archived or deleted account, or into a `closed` invoice (except `adjustment`/`invoice_payment`/`refund` entries) | Trigger `postings_guard_insert` |
| 6 ✅ | All rows share one `workspace_id` | Composite FKs. The posting → account FK also carries `account_kind`, so an account's kind can't change once it has postings. It is deferred, so erasing a workspace can remove accounts and postings in one statement |
| 7 ✅ | Postings are immutable: no UPDATE, no DELETE, and no new posting on an entry recorded in an earlier transaction. An entry can change only `description` and `notes` in place (plus soft delete / restore); anything else is a replacement. No hard DELETE of entries | Triggers `postings_are_immutable`, `postings_guard_insert`, `journal_entries_guard_changes`. Hard deletes pass only while the whole workspace is being erased |
| 8 ✅ | An entry with postings on a `closed` invoice can't be soft-deleted or restored. Fix it with a `refund`/`adjustment` entry on the open invoice | Trigger `journal_entries_guard_changes` (`entry_touches_closed_invoice()`) |
| 9 ✅ | An account used by active entries can't be soft-deleted (archive it), and an entry using a deleted account can't be restored | Triggers `ledger_accounts_refuse_deleting_used`, `journal_entries_guard_changes` |
| 10 ✅ | An entry and the entry it replaces are never both active, and an entry has at most one active replacement | Deferred trigger `journal_entries_replacement_not_both_active` + partial unique index |

"Recorded in an earlier transaction" compares the entry's `created_at` (always stamped with the
transaction's `now()` on insert) with the current `now()`.

## Derived views
| View | Per | Columns |
|---|---|---|
| `account_balances` | account (not deleted) | `balance_cents` (signed, debit +) and `natural_balance_cents` (liabilities, income and equity flipped, as the UI shows them), from postings of active entries |
| `invoice_totals` | invoice | `total_cents` (everything but invoice payments, so refunds reduce it), `paid_cents` (invoice payments), `due_cents` = total − paid |

Read through `listAccountBalances(db, workspaceId)` and `listInvoiceTotals(db, card)`. The sum of
`balance_cents` over all accounts of a workspace is always zero.

## Services (`modules/ledger`)
Use cases live in `modules/ledger/use-cases/` (`accounts.ts`, `cards.ts`, `entries.ts`); `ledger.service.ts` re-exports them.

| Service | Does |
|---|---|
| `createAccount(db, context, input)` | Validates with `newAccountSchema` (user kinds only: no system accounts, cards come with `card_details`), checks the parent (same class, not deleted) and takes the currency from `workspace_settings` |
| `changeAccount(db, ref, change)` | Rename, move (never under a descendant), owner, color, icon, order. System accounts accept only color, icon and order |
| `createCard(db, context, input)` / `changeCard(db, card, change)` | A `credit_card` account plus its `card_details` (`newCardSchema` / `cardChangeSchema`). Errors: `CARD_INVALID`, `CARD_NOT_FOUND`, `PAYMENT_ACCOUNT_NOT_AVAILABLE`, `ACCOUNT_NAME_TAKEN` |
| `archiveAccount` / `unarchiveAccount` | Archive keeps history; archived accounts leave the pickers and take no new postings |
| `deleteAccount(db, input, clock)` / `restoreAccount` | Soft delete (refused for system accounts, accounts with active children or used by active entries) and restore (refused under a deleted parent or when the name was taken meanwhile) |
| `recordEntry(db, context, input)` | Validates with `entryInputSchema`, loads the accounts (same workspace, not archived, not deleted), plans the postings with `planPostings()` (`packages/shared/src/ledger/postings.ts`) and writes the entry with its postings |
| `changeEntryDetails(db, ref, change)` | Description and notes in place |
| `deleteEntry(db, input, clock)` | Soft delete with who, when and why |
| `restoreEntry(db, ref)` | Back from the trash. A database refusal becomes `ENTRY_CANNOT_BE_RESTORED` |
| `replaceEntry(db, context, entryId, input, clock)` | Locks the entry, soft-deletes it and records the new one with `replaces_entry_id`, in one transaction |

Account errors: `ACCOUNT_INVALID`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_DELETED`, `ACCOUNT_NAME_TAKEN`,
`PARENT_NOT_AVAILABLE`, `PARENT_OF_ANOTHER_CLASS`, and `ACCOUNT_CHANGE_REFUSED` /
`ACCOUNT_CANNOT_BE_DELETED` / `ACCOUNT_CANNOT_BE_RESTORED` when a database rule refuses.

Entry types supported so far: `expense` (paid from a money account: checking, savings, cash
wallet, investment), `income`, `transfer` between two money accounts, `opening_balance` (signed:
negative = overdraft, against the system account), `card_purchase` (1–48 installments on the
card's invoices, payment method `credit` by default) and `invoice_payment` (partial payments
allowed, from the card's payment account unless another money account is given). Refunds,
adjustments and settlements come later.

Card errors: `NOT_A_CARD`, `CARD_NOT_SET_UP`, `INVOICE_CLOSED`, `INVOICE_NOT_FOUND`,
`PAYMENT_ACCOUNT_REQUIRED`, `TOO_MANY_INSTALLMENTS`.

**Purchases already in progress** (decided with the user on 2026-09-25): a card purchase takes
`firstInstallment` (default 1) and records only installments `firstInstallment..installmentCount`.
The amount is still the purchase total; the installment amounts come from splitting that total, and
each installment goes to the invoice it would always have landed on. If the first recorded
installment is still on a closed invoice, `INVOICE_CLOSED` says which installment is the first open
one. Use it to onboard purchases made before the app, or a purchase recorded late. Errors are `ValidationError` codes: `ENTRY_INVALID`,
`ACCOUNT_NOT_AVAILABLE` or the planner rule (`NOT_AN_EXPENSE_CATEGORY`, `SAME_ACCOUNT`...).

`spent_by_user_id` must be an active member of the workspace when the entry is recorded (trigger
`journal_entries_spender_is_member`, error `SPENT_BY_NOT_A_MEMBER`). Entries of someone who later
leaves stay valid. Decided with the user on 2026-09-25.

**Correction policy** (ADR 0016):
- **Delete:** soft delete (`deleted_at`). The whole entry leaves all sums together, so the ledger stays balanced. It can be restored from the trash.
- **Edit amounts, accounts, dates or splits:** the service soft-deletes the old entry and creates a new one with `replaces_entry_id`. The user sees an "edit"; history keeps both versions.
- **Edit description/notes/tags:** updated in place (audit logged).
- **After the invoice closed:** no delete. The correction is a new `refund`/`adjustment` on the open invoice, mirroring what the bank does.
- "Desfazer" in the agent = soft delete of the last entry the user created.

## HTTP routes (`ledger.routes.ts`)
All under `/api/workspaces/:workspaceId`, behind the session and workspace checks
(`access-control.md` → HTTP). Bodies are validated with the shared schemas and again by the service.
A malformed or unknown id, or one from another workspace, is `404 ACCOUNT_NOT_FOUND`.

| Route | Permission | Service |
|---|---|---|
| `GET /accounts` | `accounts:view` | `listAccounts`: active accounts (archived included, deleted not), system ones flagged `isSystem`, by `sortOrder` then name |
| `POST /accounts` | `accounts:create` | `createAccount` → `201 { accountId }` |
| `PATCH /accounts/:accountId` | `accounts:update` | `changeAccount` → `204` |
| `POST /accounts/:accountId/archive`, `/unarchive` | `accounts:update` | `archiveAccount`, `unarchiveAccount` → `204` |
| `DELETE /accounts/:accountId` (optional `{ reason }`) | `accounts:delete` | `deleteAccount` → `204` |
| `POST /accounts/:accountId/restore` | `accounts:delete` | `restoreAccount` → `204` |
| `GET /cards` | `cards:view` | `listCards`: active card accounts with their cycle, limit, holder and payment account |
| `POST /cards` | `cards:create` | `createCard` → `201 { accountId }` |
| `PATCH /cards/:cardId` | `cards:update` | `changeCard` (cycle, limit, holder, payment account) → `204` |
| `GET /cards/:cardId/invoices` | `cards:view` | `listInvoiceTotals`: invoices with total, paid and due, by reference month |
| `GET /entries?from&to&accountId&limit` | `entries:view` | `listEntries`: active entries with their postings, newest first; optional period (`YYYY-MM-DD`), account and `limit` (default 100, max 500) |
| `POST /entries` | `entries:create` | `recordEntry` (any `entryType` of `entryInputSchema`, source `web`) → `201 { entryId }` |
| `PUT /entries/:entryId` | `entries:update` | `replaceEntry`: the old entry goes to the trash, a new one points back to it → `201 { entryId }` |
| `PATCH /entries/:entryId` | `entries:update` | `changeEntryDetails` (description, notes) → `204` |
| `DELETE /entries/:entryId` (optional `{ reason }`) | `entries:delete` | `deleteEntry` → `204` |
| `POST /entries/:entryId/restore` | `entries:delete` | `restoreEntry` → `204` |
| `GET /balances` | `accounts:view` | `listAccountBalances`: every account that isn't deleted, with `balanceCents` (signed) and `naturalBalanceCents` (as the UI shows it), from active entries |

A card is a ledger account, so renaming, archiving, deleting and restoring it go through
`/accounts` with `accounts` permissions. `/cards/:cardId` only reaches `card_details`, so an id
that isn't a card is `404 CARD_NOT_FOUND`: the `cards` permission can't touch other accounts.

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
Credit on the **open** invoice. It's a new economic event, linked to the original through the memo.
| Account | Amount | invoice |
|---|---|---|
| Card X | +5000 | open invoice |
| Expense: (same category) | −5000 | |

### 8. Opening balance — checking starts with R$ 2.000,00
| Account | Amount |
|---|---|
| Checking | +200000 |
| Opening balance (equity) | −200000 |
