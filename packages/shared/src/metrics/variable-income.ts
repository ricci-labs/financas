import type { Period } from '@shared/calendar/calendar.types'
import { incomeNatureOf, postingsCounted, sumCents } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

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
