import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  ACCOUNT_CLASS_BY_KIND,
  ACCOUNT_CLASSES,
  ACCOUNT_KINDS,
  ENTRY_SOURCES,
  ENTRY_TYPES,
  INCOME_NATURES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  SYSTEM_ACCOUNT_KINDS,
} from '@financas/shared'
import { type SQL, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  check,
  date,
  foreignKey,
  pgEnum,
  pgTable,
  pgView,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const NO_PARENT = sql.raw(`'00000000-0000-0000-0000-000000000000'::uuid`)

export const accountKind = pgEnum('account_kind', ACCOUNT_KINDS)

export const accountClass = pgEnum('account_class', ACCOUNT_CLASSES)

export const incomeNature = pgEnum('income_nature', INCOME_NATURES)

export const entryType = pgEnum('entry_type', ENTRY_TYPES)

export const paymentMethod = pgEnum('payment_method', PAYMENT_METHODS)

export const entrySource = pgEnum('entry_source', ENTRY_SOURCES)

export const invoiceStatus = pgEnum('invoice_status', INVOICE_STATUSES)

const ACCOUNT_KINDS_WAITING_FOR_THEIR_COLUMNS = ['receivable', 'payable'] as const

const CARD_KIND = sql.raw(`'credit_card'`)

function quoted(values: readonly string[]): SQL {
  return sql.raw(values.map((value) => `'${value}'`).join(', '))
}

function classFromKind(): SQL {
  const branches = Object.entries(ACCOUNT_CLASS_BY_KIND).map(
    ([kind, accountClassName]) => `when '${kind}' then '${accountClassName}'::account_class`,
  )
  return sql.raw(`case kind ${branches.join(' ')} end`)
}

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    parentId: uuid(),
    kind: accountKind().notNull(),
    class: accountClass().notNull().generatedAlwaysAs(classFromKind),
    name: text().notNull(),
    currency: char({ length: 3 }).notNull(),
    incomeNature: incomeNature(),
    ownerUserId: uuid().references(() => users.id),
    isSystem: boolean()
      .notNull()
      .generatedAlwaysAs(() => sql`kind in (${quoted(SYSTEM_ACCOUNT_KINDS)})`),
    sortOrder: smallint().notNull().default(0),
    color: text(),
    icon: text(),
    archivedAt: timestamp({ withTimezone: true }),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('ledger_accounts_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('ledger_accounts_workspace_id_id_class_unique').on(
      table.workspaceId,
      table.id,
      table.class,
    ),
    unique('ledger_accounts_workspace_id_id_kind_unique').on(
      table.workspaceId,
      table.id,
      table.kind,
    ),
    foreignKey({
      name: 'ledger_accounts_parent_same_class_fk',
      columns: [table.workspaceId, table.parentId, table.class],
      foreignColumns: [table.workspaceId, table.id, table.class],
    }),
    uniqueIndex('ledger_accounts_sibling_name_unique')
      .on(
        table.workspaceId,
        table.class,
        sql`coalesce(${table.parentId}, ${NO_PARENT})`,
        sql`lower(${table.name})`,
      )
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('ledger_accounts_one_system_account_per_kind')
      .on(table.workspaceId, table.kind)
      .where(sql`${table.isSystem} and ${table.deletedAt} is null`),
    check('ledger_accounts_not_own_parent', sql`${table.parentId} <> ${table.id}`),
    check('ledger_accounts_currency_iso', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'ledger_accounts_income_nature',
      sql`(${table.kind} = 'income_category') = (${table.incomeNature} is not null)`,
    ),
    check(
      'ledger_accounts_system_at_root',
      sql`not ${table.isSystem} or ${table.parentId} is null`,
    ),
    tenantIsolation('ledger_accounts', table.workspaceId),
  ],
).enableRLS()

export const cardDetails = pgTable(
  'card_details',
  {
    workspaceId: uuid().notNull(),
    accountId: uuid().primaryKey(),
    accountKind: accountKind().notNull().default('credit_card'),
    closingDay: smallint().notNull(),
    dueDay: smallint().notNull(),
    purchaseOnClosingDayGoesNext: boolean().notNull().default(true),
    limitCents: bigint({ mode: 'number' }),
    holderUserId: uuid().references(() => users.id),
    paymentAccountId: uuid(),
    ...timestamps(),
  },
  (table) => [
    unique('card_details_workspace_id_account_id_unique').on(table.workspaceId, table.accountId),
    foreignKey({
      name: 'card_details_account_fk',
      columns: [table.workspaceId, table.accountId, table.accountKind],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id, ledgerAccounts.kind],
    }).onDelete('cascade'),
    foreignKey({
      name: 'card_details_payment_account_fk',
      columns: [table.workspaceId, table.paymentAccountId],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id],
    }),
    check('card_details_is_a_card', sql`${table.accountKind} = ${CARD_KIND}`),
    check('card_details_closing_day', sql`${table.closingDay} between 1 and 31`),
    check('card_details_due_day', sql`${table.dueDay} between 1 and 31`),
    check('card_details_limit', sql`${table.limitCents} is null or ${table.limitCents} > 0`),
    tenantIsolation('card_details', table.workspaceId),
  ],
).enableRLS()

export const cardInvoices = pgTable(
  'card_invoices',
  {
    workspaceId: uuid().notNull(),
    id: primaryId(),
    cardAccountId: uuid().notNull(),
    referenceMonth: date().notNull(),
    closingOn: date().notNull(),
    dueOn: date().notNull(),
    status: invoiceStatus().notNull(),
    ...timestamps(),
  },
  (table) => [
    unique('card_invoices_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('card_invoices_workspace_id_id_card_unique').on(
      table.workspaceId,
      table.id,
      table.cardAccountId,
    ),
    unique('card_invoices_card_month_unique').on(
      table.workspaceId,
      table.cardAccountId,
      table.referenceMonth,
    ),
    foreignKey({
      name: 'card_invoices_card_fk',
      columns: [table.workspaceId, table.cardAccountId],
      foreignColumns: [cardDetails.workspaceId, cardDetails.accountId],
    }).onDelete('cascade'),
    check(
      'card_invoices_reference_month_first_day',
      sql`extract(day from ${table.referenceMonth}) = 1`,
    ),
    check('card_invoices_due_after_closing', sql`${table.dueOn} > ${table.closingOn}`),
    tenantIsolation('card_invoices', table.workspaceId),
  ],
).enableRLS()

export const journalEntries = pgTable(
  'journal_entries',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    occurredOn: date().notNull(),
    description: text().notNull(),
    entryType: entryType().notNull(),
    paymentMethod: paymentMethod(),
    installmentCount: smallint().notNull().default(1),
    spentByUserId: uuid().references(() => users.id),
    source: entrySource().notNull(),
    createdByUserId: uuid()
      .notNull()
      .references(() => users.id),
    replacesEntryId: uuid(),
    externalRef: text(),
    notes: text(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('journal_entries_workspace_id_id_unique').on(table.workspaceId, table.id),
    foreignKey({
      name: 'journal_entries_replaces_entry_fk',
      columns: [table.workspaceId, table.replacesEntryId],
      foreignColumns: [table.workspaceId, table.id],
    }),
    uniqueIndex('journal_entries_one_active_replacement')
      .on(table.workspaceId, table.replacesEntryId)
      .where(sql`${table.replacesEntryId} is not null and ${table.deletedAt} is null`),
    uniqueIndex('journal_entries_external_ref_unique')
      .on(table.workspaceId, table.externalRef)
      .where(sql`${table.externalRef} is not null`),
    check('journal_entries_installment_count', sql`${table.installmentCount} >= 1`),
    check('journal_entries_description', sql`length(trim(${table.description})) > 0`),
    check(
      'journal_entries_not_replacing_itself',
      sql`${table.replacesEntryId} is null or ${table.replacesEntryId} <> ${table.id}`,
    ),
    tenantIsolation('journal_entries', table.workspaceId),
  ],
).enableRLS()

export const postings = pgTable(
  'postings',
  {
    workspaceId: uuid().notNull(),
    id: primaryId(),
    entryId: uuid().notNull(),
    lineNo: smallint().notNull(),
    accountId: uuid().notNull(),
    accountKind: accountKind().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    effectiveOn: date().notNull(),
    invoiceId: uuid(),
    installmentNo: smallint(),
    memo: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('postings_entry_line_unique').on(table.entryId, table.lineNo),
    foreignKey({
      name: 'postings_entry_fk',
      columns: [table.workspaceId, table.entryId],
      foreignColumns: [journalEntries.workspaceId, journalEntries.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'postings_account_fk',
      columns: [table.workspaceId, table.accountId, table.accountKind],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id, ledgerAccounts.kind],
    }),
    foreignKey({
      name: 'postings_invoice_of_the_card_fk',
      columns: [table.workspaceId, table.invoiceId, table.accountId],
      foreignColumns: [cardInvoices.workspaceId, cardInvoices.id, cardInvoices.cardAccountId],
    }),
    check(
      'postings_invoice_exactly_on_cards',
      sql`(${table.accountKind} = ${CARD_KIND}) = (${table.invoiceId} is not null)`,
    ),
    check('postings_amount_not_zero', sql`${table.amountCents} <> 0`),
    check('postings_line_no', sql`${table.lineNo} >= 1`),
    check(
      'postings_installment_no',
      sql`${table.installmentNo} is null or ${table.installmentNo} >= 1`,
    ),
    check(
      'postings_kinds_waiting_for_their_columns',
      sql`${table.accountKind} not in (${quoted(ACCOUNT_KINDS_WAITING_FOR_THEIR_COLUMNS)})`,
    ),
    tenantIsolation('postings', table.workspaceId),
  ],
).enableRLS()

export const accountBalances = pgView('account_balances', {
  workspaceId: uuid().notNull(),
  accountId: uuid().notNull(),
  kind: accountKind().notNull(),
  class: accountClass().notNull(),
  balanceCents: bigint({ mode: 'number' }).notNull(),
  naturalBalanceCents: bigint({ mode: 'number' }).notNull(),
})
  .with({ securityInvoker: true })
  .as(sql`
    select
      account.workspace_id,
      account.id as account_id,
      account.kind,
      account.class,
      coalesce(sum(line.amount_cents) filter (where entry.id is not null), 0)::bigint
        as balance_cents,
      (case when account.class in ('liability', 'income', 'equity') then -1 else 1 end
        * coalesce(sum(line.amount_cents) filter (where entry.id is not null), 0))::bigint
        as natural_balance_cents
    from ledger_accounts account
    left join postings line
      on line.workspace_id = account.workspace_id and line.account_id = account.id
    left join journal_entries entry
      on entry.workspace_id = line.workspace_id
      and entry.id = line.entry_id
      and entry.deleted_at is null
    where account.deleted_at is null
    group by account.workspace_id, account.id, account.kind, account.class
  `)

export const invoiceTotals = pgView('invoice_totals', {
  workspaceId: uuid().notNull(),
  invoiceId: uuid().notNull(),
  cardAccountId: uuid().notNull(),
  referenceMonth: date().notNull(),
  closingOn: date().notNull(),
  dueOn: date().notNull(),
  status: invoiceStatus().notNull(),
  totalCents: bigint({ mode: 'number' }).notNull(),
  paidCents: bigint({ mode: 'number' }).notNull(),
  dueCents: bigint({ mode: 'number' }).notNull(),
})
  .with({ securityInvoker: true })
  .as(sql`
    select
      invoice.workspace_id,
      invoice.id as invoice_id,
      invoice.card_account_id,
      invoice.reference_month,
      invoice.closing_on,
      invoice.due_on,
      invoice.status,
      coalesce(-sum(line.amount_cents)
        filter (where entry.entry_type <> 'invoice_payment'), 0)::bigint as total_cents,
      coalesce(sum(line.amount_cents)
        filter (where entry.entry_type = 'invoice_payment'), 0)::bigint as paid_cents,
      coalesce(-sum(line.amount_cents) filter (where entry.id is not null), 0)::bigint
        as due_cents
    from card_invoices invoice
    left join postings line
      on line.workspace_id = invoice.workspace_id and line.invoice_id = invoice.id
    left join journal_entries entry
      on entry.workspace_id = line.workspace_id
      and entry.id = line.entry_id
      and entry.deleted_at is null
    group by invoice.workspace_id, invoice.id
  `)
