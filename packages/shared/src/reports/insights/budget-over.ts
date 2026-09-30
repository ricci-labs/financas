import type { InsightRule } from '@shared/reports/insights/insights.types'

export const budgetOver: InsightRule = (_facts, { budgetPace }) =>
  budgetPace
    .filter((line) => line.status === 'over')
    .map((line) => ({
      code: 'budget_over',
      severity: 'alert',
      subject: line.categoryAccountId,
      values: { limitCents: line.limitCents, spentCents: line.spentCents },
    }))
