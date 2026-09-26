import { balanceGoingNegative } from '@shared/insights/balance-going-negative'
import { budgetAhead } from '@shared/insights/budget-ahead'
import { budgetOver } from '@shared/insights/budget-over'
import { contactOverdue } from '@shared/insights/contact-overdue'
import { INSIGHT_SEVERITIES } from '@shared/insights/insights.constants'
import type { Insight, InsightRule } from '@shared/insights/insights.types'
import { occurrenceOverdue } from '@shared/insights/occurrence-overdue'
import { periodHeavilyCommitted } from '@shared/insights/period-heavily-committed'
import { periodOverspent } from '@shared/insights/period-overspent'
import { variableIncomeToSplit } from '@shared/insights/variable-income-to-split'
import type { PeriodMetrics } from '@shared/metrics/metrics'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export const INSIGHTS: readonly InsightRule[] = [
  occurrenceOverdue,
  budgetAhead,
  periodOverspent,
  budgetOver,
  periodHeavilyCommitted,
  variableIncomeToSplit,
  balanceGoingNegative,
  contactOverdue,
]

export function computeInsights(facts: PeriodFacts, metrics: PeriodMetrics): Insight[] {
  const severityRank = (insight: Insight) => INSIGHT_SEVERITIES.indexOf(insight.severity)
  return INSIGHTS.flatMap((rule) => rule(facts, metrics)).sort(
    (left, right) => severityRank(left) - severityRank(right),
  )
}
