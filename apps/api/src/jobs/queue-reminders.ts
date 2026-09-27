import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import type { ScheduledJob } from '@api/jobs/jobs.types'
import { queueReminders } from '@api/modules/notifications'

const EVERY_DAY_AT_8_07 = '7 8 * * *'

export const queueRemindersJob: ScheduledJob = {
  name: 'queue-reminders',
  schedule: EVERY_DAY_AT_8_07,
  run: async (deps) => {
    let queued = 0
    const workspaces = await forEachWorkspace(deps, async (workspaceId) => {
      queued += await queueReminders(deps.db, workspaceId, deps.clock)
    })
    return { ...workspaces, queued }
  },
}
