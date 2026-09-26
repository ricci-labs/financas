import type { IsoDate, Period } from '@shared/calendar/calendar.types'
import type { CardCycle } from '@shared/cards/cards.types'
import type { AccountClass, AccountKind, IncomeNature } from '@shared/ledger/ledger.constants'
import type { OccurrenceStatus, RecurringEntryType } from '@shared/recurrence/recurrence.constants'
import type { BudgetBase, InstallmentBudgetView } from '@shared/workspaces/workspaces.constants'

export type FactAccount = {
  id: string
  parentId: string | null
  kind: AccountKind
  class: AccountClass
  incomeNature: IncomeNature | null
}

export type FactPosting = {
  accountId: string
  amountCents: number
  effectiveOn: IsoDate
  occurredOn: IsoDate
}

export type FactOccurrence = {
  sourceAccountId: string
  dueOn: IsoDate
  amountCents: number
  entryType: RecurringEntryType
  status: OccurrenceStatus
  categoryAccountId: string
}

export type FactBudget = {
  categoryAccountId: string
  limitCents: number
}

export type FactCard = CardCycle & {
  accountId: string
}

export type FactInvoice = {
  cardAccountId: string
  closingOn: IsoDate
  totalCents: number
}

export type FactReserve = {
  targetCents: number
  savedCents: number
}

export type PeriodFacts = {
  today: IsoDate
  period: Period
  recentPeriods: readonly Period[]
  upcomingPeriods: readonly Period[]
  installmentBudgetView: InstallmentBudgetView
  budgetBase: BudgetBase
  accounts: readonly FactAccount[]
  postings: readonly FactPosting[]
  occurrences: readonly FactOccurrence[]
  budgets: readonly FactBudget[]
  reserve: FactReserve | null
  cards: readonly FactCard[]
  invoices: readonly FactInvoice[]
}

export type BudgetPace = {
  categoryAccountId: string
  limitCents: number
  spentCents: number
  expectedCents: number
  status: 'within' | 'ahead' | 'over'
}

export type PeriodDays = {
  total: number
  elapsed: number
  left: number
}

export type ReserveCoverage = {
  savedCents: number
  targetCents: number
  monthlySpendingCents: number
  months: number | null
}

export type CommittedPeriod = {
  label: string
  installmentsCents: number
  plannedCents: number
  committedCents: number
  fixedIncomeCents: number
  percentOfIncome: number | null
}

export type InvoiceForecast = {
  cardAccountId: string
  closingOn: IsoDate
  dueOn: IsoDate
  postedCents: number
  plannedCents: number
  forecastCents: number
}
