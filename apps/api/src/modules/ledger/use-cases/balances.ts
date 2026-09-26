import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError } from '@api/core/http/errors'
import {
  findCardCycle,
  findInvoiceOfCard,
  selectAccountBalances,
  selectInvoiceLines,
  selectInvoiceTotals,
} from '@api/modules/ledger/ledger.repository'
import type {
  AccountBalance,
  CardInvoiceRef,
  InvoiceLine,
  InvoiceTotal,
  WorkspaceCard,
} from '@api/modules/ledger/ledger.types'

export function listAccountBalances(db: Database, workspaceId: string): Promise<AccountBalance[]> {
  return withWorkspace(db, workspaceId, (tx) => selectAccountBalances(tx))
}

export function readAccountBalances(tx: WorkspaceTransaction): Promise<AccountBalance[]> {
  return selectAccountBalances(tx)
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

export function listInvoiceLines(
  db: Database,
  { workspaceId, cardAccountId, invoiceId }: CardInvoiceRef,
): Promise<InvoiceLine[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    if (!(await findInvoiceOfCard(tx, invoiceId, cardAccountId))) {
      throw new NotFoundError('INVOICE_NOT_FOUND', `Invoice ${invoiceId} not found`)
    }
    const lines = await selectInvoiceLines(tx, cardAccountId, invoiceId)
    return lines.map(({ cardAmountCents, ...line }) => ({
      ...line,
      amountCents: -cardAmountCents,
    }))
  })
}
