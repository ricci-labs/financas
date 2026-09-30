import { HEAVILY_COMMITTED_PERCENT } from '@shared/reports/insights/insights.constants'
import type { InsightRule } from '@shared/reports/insights/insights.types'

export const periodHeavilyCommitted: InsightRule = (_facts, { committedAhead }) =>
  committedAhead
    .filter(
      (period) =>
        period.percentOfIncome !== null && period.percentOfIncome >= HEAVILY_COMMITTED_PERCENT,
    )
    .map((period) => ({
      code: 'period_heavily_committed',
      severity: 'warning',
      subject: period.label,
      values: {
        percentOfIncome: period.percentOfIncome ?? 0,
        committedCents: period.committedCents,
      },
    }))
