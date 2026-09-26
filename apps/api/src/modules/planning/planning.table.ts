import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { journalEntries, ledgerAccounts } from '@api/modules/ledger/ledger.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  GOAL_NAME_MAX_LENGTH,
  HOLIDAY_NAME_MAX_LENGTH,
  MAX_RECURRENCE_BUSINESS_DAY,
  MAX_RECURRENCE_INTERVAL,
  MAX_REMIND_DAYS_BEFORE,
  OCCURRENCE_STATUSES,
  RECURRENCE_DESCRIPTION_MAX_LENGTH,
  RECURRENCE_FREQUENCIES,
  RECURRING_ENTRY_TYPES,
  WEEKEND_RULES,
} from '@financas/shared'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const workspaceHolidays = pgTable(
  'workspace_holidays',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    onDate: date().notNull(),
    name: text().notNull(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('workspace_holidays_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('workspace_holidays_one_per_day')
      .on(table.workspaceId, table.onDate)
      .where(sql`${table.deletedAt} is null`),
    check(
      'workspace_holidays_name',
      sql`length(trim(${table.name})) between 1 and ${sql.raw(String(HOLIDAY_NAME_MAX_LENGTH))}`,
    ),
    tenantIsolation('workspace_holidays', table.workspaceId),
  ],
).enableRLS()

export const recurrenceFrequency = pgEnum('recurrence_frequency', RECURRENCE_FREQUENCIES)

export const recurringEntryType = pgEnum('recurring_entry_type', RECURRING_ENTRY_TYPES)

export const weekendRule = pgEnum('weekend_rule', WEEKEND_RULES)

const limit = (value: number) => sql.raw(String(value))

export const recurrenceRules = pgTable(
  'recurrence_rules',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    description: text().notNull(),
    entryType: recurringEntryType().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    amountIsEstimate: boolean().notNull().default(false),
    frequency: recurrenceFrequency().notNull(),
    interval: smallint().notNull().default(1),
    dayOfMonth: smallint(),
    nthBusinessDay: smallint(),
    weekendRule: weekendRule().notNull().default('keep'),
    startsOn: date().notNull(),
    endsOn: date(),
    sourceAccountId: uuid().notNull(),
    categoryAccountId: uuid().notNull(),
    remindDaysBefore: smallint(),
    autoRecord: boolean().notNull().default(false),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('recurrence_rules_workspace_id_id_unique').on(table.workspaceId, table.id),
    foreignKey({
      name: 'recurrence_rules_source_account_fk',
      columns: [table.workspaceId, table.sourceAccountId],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id],
    }),
    foreignKey({
      name: 'recurrence_rules_category_account_fk',
      columns: [table.workspaceId, table.categoryAccountId],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id],
    }),
    check(
      'recurrence_rules_description',
      sql`length(trim(${table.description})) between 1 and ${limit(RECURRENCE_DESCRIPTION_MAX_LENGTH)}`,
    ),
    check('recurrence_rules_amount', sql`${table.amountCents} > 0`),
    check(
      'recurrence_rules_interval',
      sql`${table.interval} between 1 and ${limit(MAX_RECURRENCE_INTERVAL)}`,
    ),
    check(
      'recurrence_rules_day_of_month',
      sql`${table.dayOfMonth} is null or ${table.dayOfMonth} between 1 and 31`,
    ),
    check(
      'recurrence_rules_nth_business_day',
      sql`${table.nthBusinessDay} is null or ${table.nthBusinessDay} between 1 and ${limit(MAX_RECURRENCE_BUSINESS_DAY)}`,
    ),
    check(
      'recurrence_rules_one_day_choice',
      sql`${table.dayOfMonth} is null or ${table.nthBusinessDay} is null`,
    ),
    check(
      'recurrence_rules_weekly_repeats_weekday',
      sql`${table.frequency} <> 'weekly' or (${table.dayOfMonth} is null and ${table.nthBusinessDay} is null)`,
    ),
    check(
      'recurrence_rules_ends_after_start',
      sql`${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn}`,
    ),
    check(
      'recurrence_rules_remind_days_before',
      sql`${table.remindDaysBefore} is null or ${table.remindDaysBefore} between 0 and ${limit(MAX_REMIND_DAYS_BEFORE)}`,
    ),
    check(
      'recurrence_rules_two_accounts',
      sql`${table.sourceAccountId} <> ${table.categoryAccountId}`,
    ),
    tenantIsolation('recurrence_rules', table.workspaceId),
  ],
).enableRLS()

export const occurrenceStatus = pgEnum('occurrence_status', OCCURRENCE_STATUSES)

export const plannedOccurrences = pgTable(
  'planned_occurrences',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    ruleId: uuid().notNull(),
    dueOn: date().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    status: occurrenceStatus().notNull().default('pending'),
    matchedEntryId: uuid(),
    ...timestamps(),
  },
  (table) => [
    unique('planned_occurrences_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('planned_occurrences_rule_due_on_unique').on(table.ruleId, table.dueOn),
    uniqueIndex('planned_occurrences_one_per_entry')
      .on(table.workspaceId, table.matchedEntryId)
      .where(sql`${table.matchedEntryId} is not null`),
    foreignKey({
      name: 'planned_occurrences_rule_fk',
      columns: [table.workspaceId, table.ruleId],
      foreignColumns: [recurrenceRules.workspaceId, recurrenceRules.id],
    }),
    foreignKey({
      name: 'planned_occurrences_matched_entry_fk',
      columns: [table.workspaceId, table.matchedEntryId],
      foreignColumns: [journalEntries.workspaceId, journalEntries.id],
    }),
    check('planned_occurrences_amount', sql`${table.amountCents} > 0`),
    check(
      'planned_occurrences_matched_has_entry',
      sql`(${table.status} = 'matched') = (${table.matchedEntryId} is not null)`,
    ),
    tenantIsolation('planned_occurrences', table.workspaceId),
  ],
).enableRLS()

export const budgetLines = pgTable(
  'budget_lines',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    categoryAccountId: uuid().notNull(),
    limitCents: bigint({ mode: 'number' }),
    validFrom: date().notNull(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('budget_lines_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('budget_lines_one_per_category_and_period')
      .on(table.workspaceId, table.categoryAccountId, table.validFrom)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      name: 'budget_lines_category_fk',
      columns: [table.workspaceId, table.categoryAccountId],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id],
    }),
    check('budget_lines_limit', sql`${table.limitCents} is null or ${table.limitCents} > 0`),
    check('budget_lines_valid_from_first_day', sql`extract(day from ${table.validFrom}) = 1`),
    tenantIsolation('budget_lines', table.workspaceId),
  ],
).enableRLS()

export const goals = pgTable(
  'goals',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    name: text().notNull(),
    targetCents: bigint({ mode: 'number' }).notNull(),
    targetOn: date(),
    accountId: uuid().notNull(),
    isReserve: boolean().notNull().default(false),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('goals_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('goals_one_per_account')
      .on(table.workspaceId, table.accountId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('goals_one_reserve')
      .on(table.workspaceId)
      .where(sql`${table.isReserve} and ${table.deletedAt} is null`),
    foreignKey({
      name: 'goals_account_fk',
      columns: [table.workspaceId, table.accountId],
      foreignColumns: [ledgerAccounts.workspaceId, ledgerAccounts.id],
    }),
    check(
      'goals_name',
      sql`length(trim(${table.name})) between 1 and ${limit(GOAL_NAME_MAX_LENGTH)}`,
    ),
    check('goals_target', sql`${table.targetCents} > 0`),
    tenantIsolation('goals', table.workspaceId),
  ],
).enableRLS()
