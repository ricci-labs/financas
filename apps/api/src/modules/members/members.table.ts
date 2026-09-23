import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { roles } from '@api/modules/access/access.table'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { sql } from 'drizzle-orm'
import { foreignKey, pgTable, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
