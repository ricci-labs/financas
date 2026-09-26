import type { Database } from '@api/core/db/db.types'
import type { IsoDate, Period, PeriodMetrics } from '@financas/shared'

export type PeriodOverview = {
  today: IsoDate
  period: Period
  metrics: PeriodMetrics
}

export type ReportRouteDeps = {
  db: Database
}

export type PeriodTimeline = {
  period: Period
  recentPeriods: Period[]
  upcomingPeriods: Period[]
}
