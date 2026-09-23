import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { roles } from '@api/modules/access/access.table'
import { notificationChannel, users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  primaryKey,
  smallint,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const memberships = pgTable(
  'memberships',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    roleId: uuid().notNull(),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('memberships_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('memberships_active_user_unique')
      .on(table.workspaceId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      name: 'memberships_role_fk',
      columns: [table.workspaceId, table.roleId],
      foreignColumns: [roles.workspaceId, roles.id],
    }),
    tenantIsolation('memberships', table.workspaceId),
  ],
).enableRLS()

export const membershipPreferences = pgTable(
  'membership_preferences',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    notifyBillsDaysBefore: smallint().notNull().default(3),
    notifyChannel: notificationChannel().notNull().default('whatsapp'),
    notifyDailyDigest: boolean().notNull().default(false),
    notifyBudgetThresholdPct: smallint().notNull().default(80),
    notifyVariableIncome: boolean().notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    check(
      'membership_preferences_bills_days',
      sql`${table.notifyBillsDaysBefore} between 0 and 30`,
    ),
    check(
      'membership_preferences_budget_threshold',
      sql`${table.notifyBudgetThresholdPct} between 1 and 100`,
    ),
    tenantIsolation('membership_preferences', table.workspaceId),
  ],
).enableRLS()
