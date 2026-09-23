import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
