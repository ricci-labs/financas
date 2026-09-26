import type { InsightRule } from '@shared/insights/insights.types'

export const periodOverspent: InsightRule = (facts, { freeToSpend }) =>
  freeToSpend < 0
    ? [
        {
          code: 'period_overspent',
          severity: 'alert',
          subject: facts.period.label,
          values: { overspentCents: -freeToSpend },
        },
      ]
    : []
