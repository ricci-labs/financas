import type { InsightRule } from '@shared/reports/insights/insights.types'

export const contactOverdue: InsightRule = (facts) =>
  facts.contactBalances
    .filter((balance) => balance.overdueCents > 0)
    .map((balance) => ({
      code: 'contact_overdue',
      severity: 'warning',
      subject: balance.contactId,
      values: { overdueCents: balance.overdueCents, owedCents: balance.owedCents },
    }))
