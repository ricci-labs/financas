import type { AccountKind, EntrySource } from '@financas/shared'

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
