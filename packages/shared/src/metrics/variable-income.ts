import { incomeNatureOf, postingsCounted, sumCents } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function variableIncome(facts: PeriodFacts): number {
  return sumCents(
    postingsCounted(facts, 'income')
      .filter((posting) => incomeNatureOf(facts, posting.accountId) === 'variable')
      .map((posting) => -posting.amountCents),
  )
}
