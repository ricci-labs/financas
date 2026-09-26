import { fixedIncome } from '@shared/metrics/fixed-income'
import type { PeriodFacts } from '@shared/metrics/metrics.types'
import { variableIncome } from '@shared/metrics/variable-income'

export function budgetIncome(facts: PeriodFacts): number {
  const fixed = fixedIncome(facts)
  return facts.budgetBase === 'all_income' ? fixed + variableIncome(facts) : fixed
}
