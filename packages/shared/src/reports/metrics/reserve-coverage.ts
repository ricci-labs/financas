import { recentActivePeriods } from '@shared/reports/metrics/facts'
import type { PeriodFacts, ReserveCoverage } from '@shared/reports/metrics/metrics.types'
import { spentIn } from '@shared/reports/metrics/spent'

const PERIODS_OF_SPENDING = 3
const TENTHS = 10

export function reserveCoverage(facts: PeriodFacts): ReserveCoverage | null {
  if (!facts.reserve) {
    return null
  }
  const { savedCents, targetCents } = facts.reserve
  const periods = recentActivePeriods(facts, PERIODS_OF_SPENDING)
  const totalSpent = periods.reduce((sum, period) => sum + spentIn(facts, period), 0)
  const monthlySpendingCents = periods.length === 0 ? 0 : Math.round(totalSpent / periods.length)
  const months =
    monthlySpendingCents > 0
      ? Math.round((savedCents * TENTHS) / monthlySpendingCents) / TENTHS
      : null
  return { savedCents, targetCents, monthlySpendingCents, months }
}
