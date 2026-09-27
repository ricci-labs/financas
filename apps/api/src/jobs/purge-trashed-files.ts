import { forEachWorkspace } from '@api/jobs/for-each-workspace'
import type { ScheduledJob } from '@api/jobs/jobs.types'
import { purgeTrashedFiles } from '@api/modules/attachments'

const EVERY_DAY_AT_3_37 = '37 3 * * *'

export const purgeTrashedFilesJob: ScheduledJob = {
  name: 'purge-trashed-files',
  schedule: EVERY_DAY_AT_3_37,
  run: async (deps) => {
    let purged = 0
    const workspaces = await forEachWorkspace(deps, async (workspaceId) => {
      purged += await purgeTrashedFiles(
        { db: deps.db, storage: deps.fileStorage, clock: deps.clock },
        workspaceId,
      )
    })
    return { ...workspaces, purged }
  },
}
