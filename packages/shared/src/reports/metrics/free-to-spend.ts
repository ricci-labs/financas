import { budgetIncome } from '@shared/reports/metrics/budget-income'
import { committed } from '@shared/reports/metrics/committed'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'
import { spent } from '@shared/reports/metrics/spent'

export function freeToSpend(facts: PeriodFacts): number {
  return budgetIncome(facts) - spent(facts) - committed(facts)
}
