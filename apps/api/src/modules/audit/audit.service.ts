import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { currentOperation } from '@api/core/observability/operation-context'
import { insertAuditRow, selectAuditRows } from '@api/modules/audit/audit.repository'
import type { AuditChange, AuditItem } from '@api/modules/audit/audit.types'
import { type AuditQuery, type Page, pageOf } from '@financas/shared'

export async function recordAudit(tx: WorkspaceTransaction, change: AuditChange): Promise<void> {
  const { traceId, source } = currentOperation()
  await insertAuditRow(tx, {
    ...change,
    before: change.before ?? null,
    after: change.after ?? null,
    traceId,
    source,
  })
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
