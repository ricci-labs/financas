import type { InsightCode, InsightSeverity } from '@shared/insights/insights.constants'
import type { PeriodMetrics } from '@shared/metrics/metrics'
import type { PeriodFacts } from '@shared/metrics/metrics.types'

export type Insight = {
  code: InsightCode
  severity: InsightSeverity
  subject: string | null
  values: Record<string, number | string>
}

export type InsightRule = (facts: PeriodFacts, metrics: PeriodMetrics) => Insight[]
