import { balanceGoingNegative } from '@shared/reports/insights/balance-going-negative'
import { budgetAhead } from '@shared/reports/insights/budget-ahead'
import { budgetOver } from '@shared/reports/insights/budget-over'
import { contactOverdue } from '@shared/reports/insights/contact-overdue'
import { INSIGHT_SEVERITIES } from '@shared/reports/insights/insights.constants'
import type { Insight, InsightRule } from '@shared/reports/insights/insights.types'
import { occurrenceOverdue } from '@shared/reports/insights/occurrence-overdue'
import { periodHeavilyCommitted } from '@shared/reports/insights/period-heavily-committed'
import { periodOverspent } from '@shared/reports/insights/period-overspent'
import { variableIncomeToSplit } from '@shared/reports/insights/variable-income-to-split'
import type { PeriodMetrics } from '@shared/reports/metrics/metrics'
import type { PeriodFacts } from '@shared/reports/metrics/metrics.types'

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
