import type { ScheduledJob } from '@api/jobs/jobs.types'
import { purgeExpiredCredentialsJob } from '@api/jobs/purge-expired-credentials'

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [purgeExpiredCredentialsJob]

export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo'
