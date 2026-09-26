import { daysBetween } from '@shared/calendar/dates'
import { freeToSpend } from '@shared/metrics/free-to-spend'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export function dailyAllowance(facts: PeriodFacts): number | null {
  const daysLeft = daysLeftIn(facts)
  if (daysLeft === 0) {
    return null
  }
  return Math.floor(Math.max(freeToSpend(facts), 0) / daysLeft)
}

function daysLeftIn({ today, period }: PeriodFacts): number {
  if (today > period.end) {
    return 0
  }
  const firstDay = today < period.start ? period.start : today
  return daysBetween(firstDay, period.end) + 1
}
