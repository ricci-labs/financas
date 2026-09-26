import type { IsoDate, Period } from '@shared/calendar/calendar.types'
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

export type PeriodFacts = {
  today: IsoDate
  period: Period
  installmentBudgetView: InstallmentBudgetView
  budgetBase: BudgetBase
  accounts: readonly FactAccount[]
  postings: readonly FactPosting[]
  occurrences: readonly FactOccurrence[]
  budgets: readonly FactBudget[]
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
