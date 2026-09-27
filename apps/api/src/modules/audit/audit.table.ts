import { primaryId } from '@api/core/db/columns'
import { appRole, currentWorkspaceId } from '@api/core/db/tenancy'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { AUDIT_ACTIONS, AUDIT_SOURCES } from '@financas/shared'
import { sql } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const auditAction = pgEnum('audit_action', AUDIT_ACTIONS)

export const auditSource = pgEnum('audit_source', AUDIT_SOURCES)

export const auditLog = pgTable(
  'audit_log',
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: primaryId(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    source: auditSource().notNull(),
    traceId: text(),
    action: auditAction().notNull(),
    tableName: text().notNull(),
    rowId: uuid().notNull(),
    before: jsonb(),
    after: jsonb(),
  },
  (table) => [
    index('audit_log_timeline_idx').on(table.workspaceId, table.at, table.id),
    index('audit_log_row_idx').on(table.workspaceId, table.tableName, table.rowId),
    pgPolicy('audit_log_read', {
      as: 'permissive',
      for: 'select',
      to: appRole,
      using: sql`${table.workspaceId} = ${currentWorkspaceId}`,
    }),
    pgPolicy('audit_log_append', {
      as: 'permissive',
      for: 'insert',
      to: appRole,
      withCheck: sql`${table.workspaceId} = ${currentWorkspaceId}`,
    }),
  ],
).enableRLS()
