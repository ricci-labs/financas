import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTES_MAX_LENGTH,
  PIX_KEY_MAX_LENGTH,
} from '@financas/shared'
import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
