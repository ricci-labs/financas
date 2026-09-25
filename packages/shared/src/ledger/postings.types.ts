import type { IsoDate } from '@shared/calendar/calendar.types'
import type { AccountKind } from '@shared/ledger/ledger.constants'
import type { Cents } from '@shared/money/money.types'

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
      entryType: 'opening_balance'
      occurredOn: IsoDate
      balanceCents: Cents
      account: AccountRef
      openingBalanceAccount: AccountRef
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

export type PostingsPlan =
  | { ok: true; postings: PostingDraft[] }
  | { ok: false; violation: PostingsViolation }
