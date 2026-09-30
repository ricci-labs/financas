import type { IsoDate } from '@shared/core/calendar/calendar.types'
import type { Cents } from '@shared/core/money/money.types'
import type { AccountKind } from '@shared/ledger/ledger/ledger.constants'

export type AccountRef = {
  id: string
  kind: AccountKind
}

export type EntryPlan =
  | {
      entryType: 'expense'
      occurredOn: IsoDate
      amountCents: Cents
      paidFrom: AccountRef
      category: AccountRef
      shares: ContactShare[]
      receivable: AccountRef | null
    }
  | {
      entryType: 'income'
      occurredOn: IsoDate
      amountCents: Cents
      receivedIn: AccountRef
      category: AccountRef
    }
  | {
      entryType: 'transfer'
      occurredOn: IsoDate
      amountCents: Cents
      from: AccountRef
      to: AccountRef
    }
  | {
      entryType: 'card_purchase'
      occurredOn: IsoDate
      amountCents: Cents
      card: AccountRef
      category: AccountRef
      installmentCount: number
      firstInstallment: number
      installments: InstallmentTarget[]
      shares: ContactShare[]
      receivable: AccountRef | null
    }
  | {
      entryType: 'invoice_payment'
      occurredOn: IsoDate
      amountCents: Cents
      card: AccountRef
      invoiceId: string
      paidFrom: AccountRef
    }
  | {
      entryType: 'settlement'
      occurredOn: IsoDate
      amountCents: Cents
      contactId: string
      receivedIn: AccountRef
      receivable: AccountRef
    }
  | {
      entryType: 'opening_balance'
      occurredOn: IsoDate
      balanceCents: Cents
      account: AccountRef
      openingBalanceAccount: AccountRef
    }

export type ContactShare = {
  contactId: string
  amountCents: Cents
}

export type SharingParty = {
  contactId: string | null
  amountCents: Cents
}

export type InstallmentTarget = {
  invoiceId: string
  effectiveOn: IsoDate
}

export type PostingDraft = {
  lineNo: number
  accountId: string
  accountKind: AccountKind
  amountCents: Cents
  effectiveOn: IsoDate
  invoiceId: string | null
  installmentNo: number | null
  contactId: string | null
}

export type PostingsViolation =
  | 'AMOUNT_NOT_POSITIVE'
  | 'BALANCE_IS_ZERO'
  | 'NOT_A_MONEY_ACCOUNT'
  | 'NOT_A_CARD'
  | 'NO_INSTALLMENTS'
  | 'TOO_MANY_INSTALLMENTS'
  | 'FIRST_INSTALLMENT_OUT_OF_RANGE'
  | 'INSTALLMENTS_DO_NOT_MATCH'
  | 'NOT_AN_EXPENSE_CATEGORY'
  | 'NOT_AN_INCOME_CATEGORY'
  | 'NOT_THE_OPENING_BALANCE_ACCOUNT'
  | 'SAME_ACCOUNT'
  | 'NOT_THE_RECEIVABLE_ACCOUNT'
  | 'SHARE_NOT_POSITIVE'
  | 'CONTACT_TWICE'
  | 'SHARES_EXCEED_AMOUNT'

export type PostingsPlan =
  | { ok: true; postings: PostingDraft[] }
  | { ok: false; violation: PostingsViolation }

export type PlanLine = {
  account: AccountRef
  amountCents: Cents
  effectiveOn?: IsoDate
  invoiceId?: string
  installmentNo?: number
  contactId?: string
}

export type PlanOf<T extends EntryPlan['entryType']> = Extract<EntryPlan, { entryType: T }>
