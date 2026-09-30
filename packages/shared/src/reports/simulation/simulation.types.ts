import type { IsoDate } from '@shared/core/calendar/calendar.types'
import type { Insight } from '@shared/reports/insights/insights.types'
import type { FactCard } from '@shared/reports/metrics/metrics.types'

export type SimulatedPurchase = {
  amountCents: number
  installmentCount: number
  occurredOn: IsoDate
  card: FactCard | null
  paidFromAccountId: string | null
}

export type PeriodImpact = {
  label: string
  freeToSpendBefore: number
  freeToSpendAfter: number
  dailyAllowanceBefore: number | null
  dailyAllowanceAfter: number | null
}

export type ComingPeriodImpact = {
  label: string
  committedBefore: number
  committedAfter: number
  percentOfIncomeBefore: number | null
  percentOfIncomeAfter: number | null
}

export type PurchaseImpact = {
  period: PeriodImpact
  coming: ComingPeriodImpact[]
  newInsights: Insight[]
}
