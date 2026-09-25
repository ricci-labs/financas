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

const ACCOUNT_KINDS_WAITING_FOR_THEIR_COLUMNS = ['credit_card', 'receivable', 'payable'] as const

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
