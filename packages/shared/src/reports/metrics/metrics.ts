import { balanceForecast } from '@shared/reports/metrics/balance-forecast'
import { budgetIncome } from '@shared/reports/metrics/budget-income'
import { budgetPace } from '@shared/reports/metrics/budget-pace'
import { committed } from '@shared/reports/metrics/committed'
import { committedAhead } from '@shared/reports/metrics/committed-ahead'
import { dailyAllowance } from '@shared/reports/metrics/daily-allowance'
import { fixedIncome } from '@shared/reports/metrics/fixed-income'
import { freeToSpend } from '@shared/reports/metrics/free-to-spend'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'
import { nextInvoice } from '@shared/reports/metrics/next-invoice'
import { reserveCoverage } from '@shared/reports/metrics/reserve-coverage'
import { spent } from '@shared/reports/metrics/spent'
import { variableAverage } from '@shared/reports/metrics/variable-average'
import { variableIncome } from '@shared/reports/metrics/variable-income'

export const METRICS = {
  fixedIncome,
  variableIncome,
  budgetIncome,
  spent,
  committed,
  freeToSpend,
  dailyAllowance,
  budgetPace,
  variableAverage,
  reserveCoverage,
  committedAhead,
  nextInvoice,
  balanceForecast,
} as const

export type PeriodMetrics = { [Key in keyof typeof METRICS]: ReturnType<(typeof METRICS)[Key]> }

export function computeMetrics(facts: PeriodFacts): PeriodMetrics {
  return Object.fromEntries(
    Object.entries(METRICS).map(([key, metric]) => [key, metric(facts)]),
  ) as PeriodMetrics
}
