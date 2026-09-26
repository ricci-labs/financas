import type { WorkspaceTransaction } from '@api/core/db/db.types'
import {
  selectAccountBalances,
  selectActiveAccounts,
  selectActiveCards,
  selectContactPostings,
  selectInvoiceFacts,
  selectPostingFacts,
} from '@api/modules/ledger/ledger.repository'
import type {
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
