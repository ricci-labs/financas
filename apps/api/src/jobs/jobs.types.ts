import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import type { Mailer } from '@api/core/email/email.types'
import type { Logger } from '@api/core/observability/logger'
import type { FileStorage } from '@api/core/storage/storage.types'

export type JobDeps = {
  db: Database
  clock: Clock
  logger: Logger
  mailer: Mailer
  publicUrl: string
  fileStorage: FileStorage
}

export type JobResult = Record<string, number>

export type ScheduledJob = {
  name: string
  schedule: string
  run: (deps: JobDeps) => Promise<JobResult>
}

export type SchedulerDeps = JobDeps & {
  timezone: string
}

export type WorkspaceWork = (workspaceId: string) => Promise<void>

export type Scheduler = {
  stop: () => Promise<void>
}
