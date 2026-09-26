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
  EntryType,
  IncomeNature,
  InvoiceStatus,
  PaymentMethod,
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

export type CardItem = {
  accountId: string
  name: string
  color: string | null
  icon: string | null
  sortOrder: number
  archivedAt: Date | null
  closingDay: number
  dueDay: number
  purchaseOnClosingDayGoesNext: boolean
  limitCents: number | null
  holderUserId: string | null
  paymentAccountId: string | null
}

export type PostingItem = {
  lineNo: number
  accountId: string
  accountKind: AccountKind
  amountCents: number
  effectiveOn: string
  invoiceId: string | null
  installmentNo: number | null
}

export type EntryItem = {
  id: string
  entryType: EntryType
  occurredOn: string
  description: string
  notes: string | null
  paymentMethod: PaymentMethod | null
  installmentCount: number
  spentByUserId: string | null
  createdByUserId: string
  source: EntrySource
  replacesEntryId: string | null
  postings: PostingItem[]
}

export type InvoiceLine = {
  entryId: string
  entryType: EntryType
  occurredOn: string
  description: string
  installmentNo: number | null
  installmentCount: number
  amountCents: number
}

export type CardInvoiceRef = WorkspaceCard & {
  invoiceId: string
}

export type Deletion = {
  deletedAt: Date
  deletedByUserId: string | null
  deleteReason: string | null
}

export type TrashedAccount = LedgerAccountItem & Deletion

export type TrashedEntry = EntryItem & Deletion
