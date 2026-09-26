import { primaryId, softDelete, timestamps } from '@api/core/db/columns'
import { tenantIsolation } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { HOLIDAY_NAME_MAX_LENGTH } from '@financas/shared'
import { sql } from 'drizzle-orm'
import { check, date, pgTable, text, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
