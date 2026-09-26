import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  CHARGE_STATUSES,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTES_MAX_LENGTH,
  PIX_KEY_MAX_LENGTH,
} from '@financas/shared'
import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  foreignKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const limit = (value: number) => sql.raw(String(value))

export const contacts = pgTable(
  'contacts',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    name: text().notNull(),
    phoneE164: text('phone_e164'),
    pixKey: text(),
    notes: text(),
    optedOutAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    ...softDelete(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('contacts_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('contacts_one_per_phone')
      .on(table.workspaceId, table.phoneE164)
      .where(sql`${table.phoneE164} is not null and ${table.deletedAt} is null`),
    check(
      'contacts_name',
      sql`length(trim(${table.name})) between 1 and ${limit(CONTACT_NAME_MAX_LENGTH)}`,
    ),
    check(
      'contacts_phone_e164',
      sql`${table.phoneE164} is null or ${table.phoneE164} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
    check(
      'contacts_pix_key',
      sql`${table.pixKey} is null or length(${table.pixKey}) between 1 and ${limit(PIX_KEY_MAX_LENGTH)}`,
    ),
    check(
      'contacts_notes',
      sql`${table.notes} is null or length(${table.notes}) <= ${limit(CONTACT_NOTES_MAX_LENGTH)}`,
    ),
    tenantIsolation('contacts', table.workspaceId),
  ],
).enableRLS()

export const chargeStatus = pgEnum('charge_status', CHARGE_STATUSES)

export const charges = pgTable(
  'charges',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    contactId: uuid().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    dueOn: date(),
    status: chargeStatus().notNull().default('draft'),
    messageText: text().notNull(),
    pixPayload: text(),
    sentAt: timestamp({ withTimezone: true }),
    lastRemindedAt: timestamp({ withTimezone: true }),
    createdByUserId: uuid()
      .notNull()
      .references(() => users.id),
    ...timestamps(),
  },
  (table) => [
    unique('charges_workspace_id_id_unique').on(table.workspaceId, table.id),
    foreignKey({
      name: 'charges_contact_fk',
      columns: [table.workspaceId, table.contactId],
      foreignColumns: [contacts.workspaceId, contacts.id],
    }),
    check('charges_amount', sql`${table.amountCents} > 0`),
    check(
      'charges_sent_when_sent',
      sql`${table.status} = 'draft' or ${table.status} = 'cancelled' or ${table.sentAt} is not null`,
    ),
    tenantIsolation('charges', table.workspaceId),
  ],
).enableRLS()

export const chargeItems = pgTable(
  'charge_items',
  {
    workspaceId: uuid().notNull(),
    id: primaryId(),
    chargeId: uuid().notNull(),
    postingId: uuid().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('charge_items_charge_posting_unique').on(table.chargeId, table.postingId),
    foreignKey({
      name: 'charge_items_charge_fk',
      columns: [table.workspaceId, table.chargeId],
      foreignColumns: [charges.workspaceId, charges.id],
    }).onDelete('cascade'),
    check('charge_items_amount', sql`${table.amountCents} > 0`),
    tenantIsolation('charge_items', table.workspaceId),
  ],
).enableRLS()

export const chargePayments = pgTable(
  'charge_payments',
  {
    workspaceId: uuid().notNull(),
    id: primaryId(),
    chargeId: uuid().notNull(),
    entryId: uuid().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('charge_payments_entry_unique').on(table.entryId),
    foreignKey({
      name: 'charge_payments_charge_fk',
      columns: [table.workspaceId, table.chargeId],
      foreignColumns: [charges.workspaceId, charges.id],
    }).onDelete('cascade'),
    check('charge_payments_amount', sql`${table.amountCents} > 0`),
    tenantIsolation('charge_payments', table.workspaceId),
  ],
).enableRLS()
