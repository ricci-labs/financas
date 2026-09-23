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
  text,
  timestamp,
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

export const invitations = pgTable(
  'invitations',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    email: text(),
    phoneE164: text('phone_e164'),
    roleId: uuid().notNull(),
    tokenHash: text().notNull(),
    invitedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedByUserId: uuid().references(() => users.id),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('invitations_token_hash_unique').on(table.tokenHash),
    foreignKey({
      name: 'invitations_role_fk',
      columns: [table.workspaceId, table.roleId],
      foreignColumns: [roles.workspaceId, roles.id],
    }),
    uniqueIndex('invitations_pending_email_unique')
      .on(table.workspaceId, sql`lower(${table.email})`)
      .where(
        sql`${table.email} is not null and ${table.acceptedAt} is null and ${table.deletedAt} is null`,
      ),
    uniqueIndex('invitations_pending_phone_unique')
      .on(table.workspaceId, table.phoneE164)
      .where(
        sql`${table.phoneE164} is not null and ${table.acceptedAt} is null and ${table.deletedAt} is null`,
      ),
    check('invitations_one_contact', sql`num_nonnulls(${table.email}, ${table.phoneE164}) = 1`),
    check(
      'invitations_email_format',
      sql`${table.email} is null or ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`,
    ),
    check(
      'invitations_phone_format',
      sql`${table.phoneE164} is null or ${table.phoneE164} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
    check(
      'invitations_acceptance_pair',
      sql`(${table.acceptedAt} is null) = (${table.acceptedByUserId} is null)`,
    ),
    check('invitations_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    tenantIsolation('invitations', table.workspaceId),
  ],
).enableRLS()
