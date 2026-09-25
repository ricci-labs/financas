import type { AccountClass, AccountKind, EntrySource, InvoiceStatus } from '@financas/shared'

export type NewLedgerAccount = {
  workspaceId: string
  kind: AccountKind
  name: string
  currency: string
}

export type EntryContext = {
  workspaceId: string
  userId: string
  source: EntrySource
}

export type RecordedEntry = {
  entryId: string
}

export type EntryRef = {
  workspaceId: string
  entryId: string
}

export type DeleteEntryInput = EntryRef & {
  userId: string
  reason?: string
}

export type LedgerContext = {
  workspaceId: string
  userId: string
}

export type WorkspaceAccount = {
  workspaceId: string
  accountId: string
}

export type DeleteAccountInput = WorkspaceAccount & {
  userId: string
  reason?: string
}

export type CreatedAccount = {
  accountId: string
}

export type WorkspaceCard = {
  workspaceId: string
  cardAccountId: string
}

export type AccountBalance = {
  accountId: string
  kind: AccountKind
  class: AccountClass
  balanceCents: number
  naturalBalanceCents: number
}

export type InvoiceTotal = {
  invoiceId: string
  referenceMonth: string
  closingOn: string
  dueOn: string
  status: InvoiceStatus
  totalCents: number
  paidCents: number
  dueCents: number
}
