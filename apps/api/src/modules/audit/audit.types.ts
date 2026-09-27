import type { Database } from '@api/core/db/db.types'
import type { auditLog } from '@api/modules/audit/audit.table'
import type { AuditAction } from '@financas/shared'

export type AuditRow = typeof auditLog.$inferSelect

export type NewAuditRow = typeof auditLog.$inferInsert

export type AuditChange = {
  workspaceId: string
  actorUserId: string | null
  action: AuditAction
  tableName: string
  rowId: string
  before?: unknown
  after?: unknown
}

export type AuditItem = Omit<AuditRow, 'workspaceId'>

export type AuditRouteDeps = {
  db: Database
}
