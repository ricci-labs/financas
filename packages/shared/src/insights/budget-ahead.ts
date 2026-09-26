import type { InsightRule } from '@shared/insights/insights.types'

export const budgetAhead: InsightRule = (_facts, { budgetPace }) =>
  budgetPace
    .filter((line) => line.status === 'ahead')
    .map((line) => ({
      code: 'budget_ahead',
      severity: 'warning',
      subject: line.categoryAccountId,
      values: {
        limitCents: line.limitCents,
        spentCents: line.spentCents,
        expectedCents: line.expectedCents,
      },
    }))
