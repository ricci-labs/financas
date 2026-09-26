import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import type { Logger } from '@api/core/observability/logger'

export type JobDeps = {
  db: Database
  clock: Clock
}

export type JobResult = Record<string, number>

export type ScheduledJob = {
  name: string
  schedule: string
  run: (deps: JobDeps) => Promise<JobResult>
}

export type SchedulerDeps = JobDeps & {
  logger: Logger
  timezone: string
}

export type Scheduler = {
  stop: () => Promise<void>
}
