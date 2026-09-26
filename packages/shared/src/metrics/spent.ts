import { postingsCounted, sumCents } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function spent(facts: PeriodFacts): number {
  return sumCents(postingsCounted(facts, 'expense').map((posting) => posting.amountCents))
}
