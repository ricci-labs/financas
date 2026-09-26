import { periodDays } from '@shared/metrics/facts'
import { freeToSpend } from '@shared/metrics/free-to-spend'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function dailyAllowance(facts: PeriodFacts): number | null {
  const { left } = periodDays(facts)
  if (left === 0) {
    return null
  }
  return Math.floor(Math.max(freeToSpend(facts), 0) / left)
}
