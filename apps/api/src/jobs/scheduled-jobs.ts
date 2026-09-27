import type { ScheduledJob } from '@api/jobs/jobs.types'
import { planOccurrencesJob } from '@api/jobs/plan-occurrences'
import { purgeExpiredCredentialsJob } from '@api/jobs/purge-expired-credentials'
import { sendNotificationsJob } from '@api/jobs/send-notifications'

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  purgeExpiredCredentialsJob,
  planOccurrencesJob,
  sendNotificationsJob,
]

export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo'
