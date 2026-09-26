import type { ScheduledJob } from '@api/jobs/jobs.types'
import { purgeExpiredCredentials } from '@api/modules/identity'

const EVERY_DAY_AT_3_17 = '17 3 * * *'

export const purgeExpiredCredentialsJob: ScheduledJob = {
  name: 'purge-expired-credentials',
  schedule: EVERY_DAY_AT_3_17,
  run: ({ db, clock }) => purgeExpiredCredentials(db, clock),
}
