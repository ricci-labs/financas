import type { Database } from '@api/core/db/db.types'
import type { Insight, IsoDate, Period, PeriodMetrics } from '@financas/shared'

export type PeriodOverview = {
  today: IsoDate
  period: Period
  metrics: PeriodMetrics
  insights: Insight[]
}

export type ReportRouteDeps = {
  db: Database
}

export type PeriodTimeline = {
  period: Period
  recentPeriods: Period[]
  upcomingPeriods: Period[]
}
