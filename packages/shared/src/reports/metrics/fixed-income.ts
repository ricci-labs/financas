import {
  incomeNatureOf,
  pendingInPeriod,
  postingsCounted,
  sumCents,
} from '@shared/reports/metrics/facts'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'

export function fixedIncome(facts: PeriodFacts): number {
  const received = postingsCounted(facts, 'income')
    .filter((posting) => incomeNatureOf(facts, posting.accountId) === 'fixed')
    .map((posting) => -posting.amountCents)
  const expected = pendingInPeriod(facts, ['income'])
    .filter((occurrence) => incomeNatureOf(facts, occurrence.categoryAccountId) === 'fixed')
    .map((occurrence) => occurrence.amountCents)
  return sumCents([...received, ...expected])
}
