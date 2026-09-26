import type { Database } from '@api/core/db/db.types'
import type {
  cardDetails,
  cardInvoices,
  journalEntries,
  ledgerAccounts,
  postings,
} from '@api/modules/ledger/ledger.table'
import type {
  AccountClass,
  AccountKind,
  AccountRef,
  CardCycle,
  EntryInput,
  EntrySource,
  IncomeNature,
  InvoiceStatus,
} from '@financas/shared'

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

export type AccountsById = ReadonlyMap<string, AccountRef>

export type NewEntry = typeof journalEntries.$inferInsert

export type NewPosting = typeof postings.$inferInsert

export type NewAccount = typeof ledgerAccounts.$inferInsert

export type AccountUpdate = Partial<
  Pick<NewAccount, 'name' | 'parentId' | 'ownerUserId' | 'color' | 'icon' | 'sortOrder'>
>

export type NewCardDetails = typeof cardDetails.$inferInsert

export type CardDetailsUpdate = Partial<
  Pick<
    NewCardDetails,
    | 'closingDay'
    | 'dueDay'
    | 'purchaseOnClosingDayGoesNext'
    | 'limitCents'
    | 'holderUserId'
    | 'paymentAccountId'
  >
>

export type NewInvoice = typeof cardInvoices.$inferInsert

export type CardPurchaseInput = Extract<EntryInput, { entryType: 'card_purchase' }>

export type InvoicePaymentInput = Extract<EntryInput, { entryType: 'invoice_payment' }>

export type CardSetup = CardCycle & {
  paymentAccountId: string | null
}

export type LedgerAccountItem = {
  id: string
  parentId: string | null
  kind: AccountKind
  class: AccountClass
  name: string
  currency: string
  incomeNature: IncomeNature | null
  ownerUserId: string | null
  isSystem: boolean
  sortOrder: number
  color: string | null
  icon: string | null
  archivedAt: Date | null
}

export type LedgerRouteDeps = {
  db: Database
}
