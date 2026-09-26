import type { InsightRule } from '@shared/insights/insights.types'

export const occurrenceOverdue: InsightRule = (facts) =>
  facts.occurrences
    .filter((occurrence) => occurrence.status === 'pending' && occurrence.dueOn < facts.today)
    .map((occurrence) => ({
      code: 'occurrence_overdue',
      severity: 'warning',
      subject: occurrence.id,
      values: { dueOn: occurrence.dueOn, amountCents: occurrence.amountCents },
    }))
