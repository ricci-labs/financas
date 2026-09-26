import { budgetIncome } from '@shared/metrics/budget-income'
import { committed } from '@shared/metrics/committed'
import type { PeriodFacts } from '@shared/metrics/metrics.types'
import { spent } from '@shared/metrics/spent'

export function freeToSpend(facts: PeriodFacts): number {
  return budgetIncome(facts) - spent(facts) - committed(facts)
}
