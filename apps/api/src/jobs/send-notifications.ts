import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import type { ScheduledJob } from '@api/jobs/jobs.types'
import { deliverDueNotifications } from '@api/modules/notifications'

const EVERY_FIVE_MINUTES = '*/5 * * * *'

export const sendNotificationsJob: ScheduledJob = {
  name: 'send-notifications',
  schedule: EVERY_FIVE_MINUTES,
  run: async (deps) => {
    const totals = { sent: 0, retried: 0, failed: 0 }
    const workspaces = await forEachWorkspace(deps, async (workspaceId) => {
      const result = await deliverDueNotifications(deps.db, workspaceId, deps)
      totals.sent += result.sent
      totals.retried += result.retried
      totals.failed += result.failed
    })
    return { ...workspaces, ...totals }
  },
}
