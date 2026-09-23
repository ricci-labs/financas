import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { appRole, currentWorkspaceId } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
  (table) => [
    pgPolicy('workspaces_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: appRole,
      using: sql`${table.id} = ${currentWorkspaceId}`,
      withCheck: sql`${table.id} = ${currentWorkspaceId}`,
    }),
  ],
).enableRLS()
