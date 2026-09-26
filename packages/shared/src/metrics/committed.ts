import { pendingInPeriod, sumCents } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function committed(facts: PeriodFacts): number {
  return sumCents(
    pendingInPeriod(facts, ['expense', 'card_purchase']).map(
      (occurrence) => occurrence.amountCents,
    ),
  )
}
