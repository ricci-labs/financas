import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import type { ScheduledJob } from '@api/jobs/jobs.types'
import { refreshWorkspaceOccurrences } from '@api/modules/planning'

const EVERY_DAY_AT_2_47 = '47 2 * * *'

export const planOccurrencesJob: ScheduledJob = {
  name: 'plan-occurrences',
  schedule: EVERY_DAY_AT_2_47,
  run: (deps) =>
    forEachWorkspace(deps, (workspaceId) =>
      refreshWorkspaceOccurrences(deps.db, workspaceId, deps.clock),
    ),
}
