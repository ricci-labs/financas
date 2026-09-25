import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  ACCOUNT_CLASS_BY_KIND,
  ACCOUNT_CLASSES,
  ACCOUNT_KINDS,
  INCOME_NATURES,
  SYSTEM_ACCOUNT_KINDS,
} from '@financas/shared'
import { type SQL, sql } from 'drizzle-orm'
import {
  boolean,
  char,
  check,
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
