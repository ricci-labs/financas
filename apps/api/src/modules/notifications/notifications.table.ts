import { primaryId, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { contacts } from '@api/modules/contacts/contacts.table'
import { notificationChannel, users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { NOTIFICATION_KINDS, NOTIFICATION_STATUSES } from '@financas/shared'
import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const notificationKind = pgEnum('notification_kind', NOTIFICATION_KINDS)

export const notificationStatus = pgEnum('notification_status', NOTIFICATION_STATUSES)

export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    recipientUserId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    recipientContactId: uuid(),
    channel: notificationChannel().notNull(),
    kind: notificationKind().notNull(),
    payload: jsonb().notNull(),
    scheduledFor: timestamp({ withTimezone: true }).notNull(),
    status: notificationStatus().notNull().default('pending'),
    attempts: smallint().notNull().default(0),
    lastError: text(),
    sentAt: timestamp({ withTimezone: true }),
    dedupeKey: text().notNull(),
    ...timestamps(),
  },
  (table) => [
    unique('notification_outbox_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('notification_outbox_dedupe_unique').on(table.workspaceId, table.dedupeKey),
    index('notification_outbox_due_index').on(table.status, table.scheduledFor),
    foreignKey({
      name: 'notification_outbox_contact_fk',
      columns: [table.workspaceId, table.recipientContactId],
      foreignColumns: [contacts.workspaceId, contacts.id],
    }),
    check(
      'notification_outbox_one_recipient',
      sql`num_nonnulls(${table.recipientUserId}, ${table.recipientContactId}) = 1`,
    ),
    check('notification_outbox_attempts', sql`${table.attempts} >= 0`),
    check(
      'notification_outbox_sent_at',
      sql`(${table.status} = 'sent') = (${table.sentAt} is not null)`,
    ),
    tenantIsolation('notification_outbox', table.workspaceId),
  ],
).enableRLS()
