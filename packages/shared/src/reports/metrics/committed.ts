import { pendingInPeriod, sumCents } from '@shared/reports/metrics/facts'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'

export function committed(facts: PeriodFacts): number {
  return sumCents(
    pendingInPeriod(facts, ['expense', 'card_purchase']).map(
      (occurrence) => occurrence.amountCents,
    ),
  )
}
