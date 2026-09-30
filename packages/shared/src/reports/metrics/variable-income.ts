import type { Period } from '@shared/core/calendar/calendar.types'
import { incomeNatureOf, postingsCounted, sumCents } from '@shared/reports/metrics/facts'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'

export function variableIncome(facts: PeriodFacts): number {
  return variableIncomeIn(facts, facts.period)
}

export function variableIncomeIn(facts: PeriodFacts, period: Period): number {
  return sumCents(
    postingsCounted(facts, 'income', period)
      .filter((posting) => incomeNatureOf(facts, posting.accountId) === 'variable')
      .map((posting) => -posting.amountCents),
  )
}
