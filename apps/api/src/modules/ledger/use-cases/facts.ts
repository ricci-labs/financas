import type { WorkspaceTransaction } from '@api/core/db/db.types'
import {
  selectAccountBalances,
  selectActiveAccounts,
  selectActiveCards,
  selectActiveEntryIds,
  selectContactItems,
  selectContactPostings,
  selectInvoiceFacts,
  selectInvoicesDueBetween,
  selectPostingDetails,
  selectPostingFacts,
} from '@api/modules/ledger/ledger.repository'
import type { ContactItems, InvoiceDue, PostingDetails } from '@api/modules/ledger/ledger.types'
import type {
  ChargeableItem,
  ContactPosting,
  FactAccount,
  FactBalance,
  FactCard,
  FactInvoice,
  FactPosting,
  IsoDate,
} from '@financas/shared'

export async function readAccountFacts(tx: WorkspaceTransaction): Promise<FactAccount[]> {
  return (await selectActiveAccounts(tx)).map((account) => ({
    id: account.id,
    parentId: account.parentId,
    kind: account.kind,
    class: account.class,
    incomeNature: account.incomeNature,
  }))
}

export function readPostingFacts(
  tx: WorkspaceTransaction,
  from: IsoDate,
  to: IsoDate,
): Promise<FactPosting[]> {
  return selectPostingFacts(tx, from, to)
}

export async function readCardFacts(tx: WorkspaceTransaction): Promise<FactCard[]> {
  return (await selectActiveCards(tx)).map((card) => ({
    accountId: card.accountId,
    paymentAccountId: card.paymentAccountId,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    purchaseOnClosingDayGoesNext: card.purchaseOnClosingDayGoesNext,
  }))
}

export function readInvoiceFacts(
  tx: WorkspaceTransaction,
  closingFrom: IsoDate,
): Promise<FactInvoice[]> {
  return selectInvoiceFacts(tx, closingFrom)
}

export async function readBalanceFacts(tx: WorkspaceTransaction): Promise<FactBalance[]> {
  return (await selectAccountBalances(tx)).map(({ accountId, balanceCents }) => ({
    accountId,
    balanceCents,
  }))
}

export function readContactPostings(
  tx: WorkspaceTransaction,
  contactId?: string,
): Promise<ContactPosting[]> {
  return selectContactPostings(tx, contactId)
}

export async function readContactItems(
  tx: WorkspaceTransaction,
  contactId: string,
): Promise<ContactItems> {
  const lines = await selectContactItems(tx, contactId)
  const items: ChargeableItem[] = lines.filter((line) => line.amountCents > 0)
  const paidCents = -lines
    .filter((line) => line.amountCents < 0)
    .reduce((sum, line) => sum + line.amountCents, 0)
  return { items, paidCents }
}

export async function readPostingDetails(
  tx: WorkspaceTransaction,
  postingIds: string[],
): Promise<ReadonlyMap<string, PostingDetails>> {
  const details = await selectPostingDetails(tx, postingIds)
  return new Map(details.map((detail) => [detail.postingId, detail]))
}

export async function activeEntryIdsOf(
  tx: WorkspaceTransaction,
  entryIds: string[],
): Promise<ReadonlySet<string>> {
  return new Set(await selectActiveEntryIds(tx, entryIds))
}

export function readInvoicesDueBetween(
  tx: WorkspaceTransaction,
  from: IsoDate,
  to: IsoDate,
): Promise<InvoiceDue[]> {
  return selectInvoicesDueBetween(tx, from, to)
}
