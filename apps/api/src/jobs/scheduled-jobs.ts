import type { ScheduledJob } from '@api/jobs/jobs.types'
import { planOccurrencesJob } from '@api/jobs/plan-occurrences'
import { purgeExpiredCredentialsJob } from '@api/jobs/purge-expired-credentials'
import { purgeTrashedFilesJob } from '@api/jobs/purge-trashed-files'
import { queueRemindersJob } from '@api/jobs/queue-reminders'
import { sendNotificationsJob } from '@api/jobs/send-notifications'

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  purgeExpiredCredentialsJob,
  purgeTrashedFilesJob,
  planOccurrencesJob,
  queueRemindersJob,
  sendNotificationsJob,
]

export const SCHEDULE_TIMEZONE = 'America/Sao_Paulo'
