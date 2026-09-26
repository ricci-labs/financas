import { budgetIncome } from '@shared/metrics/budget-income'
import { budgetPace } from '@shared/metrics/budget-pace'
import { committed } from '@shared/metrics/committed'
import { committedAhead } from '@shared/metrics/committed-ahead'
import { dailyAllowance } from '@shared/metrics/daily-allowance'
import { fixedIncome } from '@shared/metrics/fixed-income'
import { freeToSpend } from '@shared/metrics/free-to-spend'
import type { PeriodFacts } from '@shared/metrics/metrics.types'
import { reserveCoverage } from '@shared/metrics/reserve-coverage'
import { spent } from '@shared/metrics/spent'
import { variableAverage } from '@shared/metrics/variable-average'
import { variableIncome } from '@shared/metrics/variable-income'

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
} as const

export type PeriodMetrics = { [Key in keyof typeof METRICS]: ReturnType<(typeof METRICS)[Key]> }

export function computeMetrics(facts: PeriodFacts): PeriodMetrics {
  return Object.fromEntries(
    Object.entries(METRICS).map(([key, metric]) => [key, metric(facts)]),
  ) as PeriodMetrics
}
