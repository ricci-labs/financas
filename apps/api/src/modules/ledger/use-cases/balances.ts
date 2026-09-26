import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError } from '@api/core/http/errors'
import {
  findCardCycle,
  selectAccountBalances,
  selectInvoiceTotals,
} from '@api/modules/ledger/ledger.repository'
import type { AccountBalance, InvoiceTotal, WorkspaceCard } from '@api/modules/ledger/ledger.types'

export function listAccountBalances(db: Database, workspaceId: string): Promise<AccountBalance[]> {
  return withWorkspace(db, workspaceId, (tx) => selectAccountBalances(tx))
}

export function listInvoiceTotals(
  db: Database,
  { workspaceId, cardAccountId }: WorkspaceCard,
): Promise<InvoiceTotal[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    if (!(await findCardCycle(tx, cardAccountId))) {
      throw new NotFoundError('CARD_NOT_FOUND', `Card ${cardAccountId} not found`)
    }
    return selectInvoiceTotals(tx, cardAccountId)
  })
}
