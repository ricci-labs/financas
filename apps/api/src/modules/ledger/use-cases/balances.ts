import type { Database } from '@api/core/db/client'
import { withWorkspace } from '@api/core/db/tx'
import { selectAccountBalances, selectInvoiceTotals } from '@api/modules/ledger/ledger.repository'
import type { AccountBalance, InvoiceTotal, WorkspaceCard } from '@api/modules/ledger/ledger.types'

export function listAccountBalances(db: Database, workspaceId: string): Promise<AccountBalance[]> {
  return withWorkspace(db, workspaceId, (tx) => selectAccountBalances(tx))
}

export function listInvoiceTotals(
  db: Database,
  { workspaceId, cardAccountId }: WorkspaceCard,
): Promise<InvoiceTotal[]> {
  return withWorkspace(db, workspaceId, (tx) => selectInvoiceTotals(tx, cardAccountId))
}
