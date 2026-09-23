import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { sql } from 'drizzle-orm'
import { char, check, pgEnum, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const periodAnchor = pgEnum('period_anchor', [
  'calendar_month',
  'day_of_month',
  'nth_business_day',
])

export const installmentBudgetView = pgEnum('installment_budget_view', [
  'purchase_month',
  'per_installment',
])

export const budgetBase = pgEnum('budget_base', ['fixed_income', 'all_income'])

export const workspaces = pgTable(
  'workspaces',
  {
    id: primaryId(),
    name: text().notNull(),
    createdByUserId: uuid()
      .notNull()
      .references(() => users.id),
    archivedAt: timestamp({ withTimezone: true }),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [tenantIsolation('workspaces', table.id)],
).enableRLS()

export const workspaceSettings = pgTable(
  'workspace_settings',
  {
    workspaceId: uuid()
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    currency: char({ length: 3 }).notNull().default('BRL'),
    timezone: text().notNull().default('America/Sao_Paulo'),
    locale: text().notNull().default('pt-BR'),
    periodAnchor: periodAnchor().notNull().default('calendar_month'),
    periodAnchorValue: smallint(),
    installmentBudgetView: installmentBudgetView().notNull().default('per_installment'),
    budgetBase: budgetBase().notNull().default('fixed_income'),
    weekStartsOn: smallint().notNull().default(0),
    pixReceivingKey: text(),
    pixReceiverName: text(),
    pixReceiverCity: text(),
    contactMessagesDailyCap: smallint().notNull().default(20),
    chargeReminderEveryDays: smallint().default(3),
    ...timestamps(),
  },
  (table) => [
    check('workspace_settings_currency_iso', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      'workspace_settings_period_anchor_value',
      sql`(${table.periodAnchor} = 'calendar_month' and ${table.periodAnchorValue} is null)
        or (${table.periodAnchor} = 'day_of_month'
          and ${table.periodAnchorValue} is not null
          and ${table.periodAnchorValue} between 1 and 31)
        or (${table.periodAnchor} = 'nth_business_day'
          and ${table.periodAnchorValue} is not null
          and ${table.periodAnchorValue} between 1 and 10)`,
    ),
    check('workspace_settings_week_start', sql`${table.weekStartsOn} between 0 and 6`),
    check(
      'workspace_settings_pix_complete',
      sql`${table.pixReceivingKey} is null
        or (${table.pixReceiverName} is not null and ${table.pixReceiverCity} is not null)`,
    ),
    check(
      'workspace_settings_pix_lengths',
      sql`coalesce(length(${table.pixReceiverName}), 0) <= 25
        and coalesce(length(${table.pixReceiverCity}), 0) <= 15`,
    ),
    check('workspace_settings_daily_cap', sql`${table.contactMessagesDailyCap} >= 0`),
    check(
      'workspace_settings_reminder_interval',
      sql`${table.chargeReminderEveryDays} is null or ${table.chargeReminderEveryDays} >= 1`,
    ),
    tenantIsolation('workspace_settings', table.workspaceId),
  ],
).enableRLS()
