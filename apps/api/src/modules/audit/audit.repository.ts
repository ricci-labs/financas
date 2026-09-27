import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { auditLog } from '@api/modules/audit/audit.table'
import type { AuditItem, AuditTarget, NewAuditRow } from '@api/modules/audit/audit.types'
import type { AuditQuery } from '@financas/shared'
import { and, desc, eq, getTableName, type SQL, sql } from 'drizzle-orm'

const AT_TO_THE_MILLISECOND = sql`date_trunc('milliseconds', ${auditLog.at})`

export async function insertAuditRow(tx: WorkspaceTransaction, row: NewAuditRow): Promise<void> {
  await tx.insert(auditLog).values(row)
}

export function selectAuditRows(tx: WorkspaceTransaction, query: AuditQuery): Promise<AuditItem[]> {
  const conditions: SQL[] = []
  if (query.tableName) {
    conditions.push(eq(auditLog.tableName, query.tableName))
  }
  if (query.rowId) {
    conditions.push(eq(auditLog.rowId, query.rowId))
  }
  if (query.cursor) {
    conditions.push(
      sql`(${AT_TO_THE_MILLISECOND}, ${auditLog.id}) < (${query.cursor.key}::timestamptz, ${query.cursor.id}::uuid)`,
    )
  }
  return tx
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actorUserId: auditLog.actorUserId,
      source: auditLog.source,
      traceId: auditLog.traceId,
      action: auditLog.action,
      tableName: auditLog.tableName,
      rowId: auditLog.rowId,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(AT_TO_THE_MILLISECOND), desc(auditLog.id))
    .limit(query.limit + 1)
}

export async function selectAuditedRow(
  tx: WorkspaceTransaction,
  { table, key, rowId, hidden = [] }: AuditTarget,
): Promise<unknown> {
  const [row] = await tx.select().from(table).where(eq(key, rowId))
  if (!row) {
    return null
  }
  return Object.fromEntries(Object.entries(row).filter(([column]) => !hidden.includes(column)))
}

export function tableNameOf({ table }: AuditTarget): string {
  return getTableName(table)
}
