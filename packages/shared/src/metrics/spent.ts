import type { Period } from '@shared/calendar/calendar.types'
import { postingsCounted, sumCents } from '@shared/metrics/facts'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function spent(facts: PeriodFacts): number {
  return spentIn(facts, facts.period)
}

export function spentIn(facts: PeriodFacts, period: Period): number {
  return sumCents(postingsCounted(facts, 'expense', period).map((posting) => posting.amountCents))
}
