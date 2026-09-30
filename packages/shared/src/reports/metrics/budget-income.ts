import { fixedIncome } from '@shared/reports/metrics/fixed-income'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'
import { variableIncome } from '@shared/reports/metrics/variable-income'

export function budgetIncome(facts: PeriodFacts): number {
  const fixed = fixedIncome(facts)
  return facts.budgetBase === 'all_income' ? fixed + variableIncome(facts) : fixed
}
