import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { currentOperation } from '@api/core/observability/operation-context'
import {
  insertAuditRow,
  selectAuditedRow,
  selectAuditRows,
  tableNameOf,
} from '@api/modules/audit/audit.repository'
import type { AuditChange, AuditItem, AuditTarget } from '@api/modules/audit/audit.types'
import { type AuditAction, type AuditQuery, type Page, pageOf } from '@financas/shared'

export async function recordAudit(tx: WorkspaceTransaction, change: AuditChange): Promise<void> {
  const { traceId, source, actorUserId } = currentOperation()
  await insertAuditRow(tx, {
    ...change,
    actorUserId: change.actorUserId ?? actorUserId,
    before: change.before ?? null,
    after: change.after ?? null,
    traceId,
    source,
  })
}

export async function auditCreation(tx: WorkspaceTransaction, target: AuditTarget): Promise<void> {
  await recordAudit(tx, {
    workspaceId: target.workspaceId,
    action: 'create',
    tableName: tableNameOf(target),
    rowId: target.rowId,
    after: await selectAuditedRow(tx, target),
  })
}

export async function audited<T>(
  tx: WorkspaceTransaction,
  target: AuditTarget,
  action: AuditAction,
  change: () => Promise<T>,
): Promise<T> {
  const before = await selectAuditedRow(tx, target)
  const result = await change()
  await recordAudit(tx, {
    workspaceId: target.workspaceId,
    action,
    tableName: tableNameOf(target),
    rowId: target.rowId,
    before,
    after: await selectAuditedRow(tx, target),
  })
  return result
}

export function listAuditEvents(
  db: Database,
  workspaceId: string,
  query: AuditQuery,
): Promise<Page<AuditItem>> {
  return withWorkspace(db, workspaceId, async (tx) =>
    pageOf(await selectAuditRows(tx, query), query.limit, (event) => ({
      key: event.at.toISOString(),
      id: event.id,
    })),
  )
}
