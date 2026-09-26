import { recentActivePeriods } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'
import { variableIncomeIn } from '@shared/metrics/variable-income'

export function variableAverage(facts: PeriodFacts): number | null {
  const periods = recentActivePeriods(facts)
  if (periods.length === 0) {
    return null
  }
  const total = periods.reduce((sum, period) => sum + variableIncomeIn(facts, period), 0)
  return Math.floor(total / periods.length)
}
