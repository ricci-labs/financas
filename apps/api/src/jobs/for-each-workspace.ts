import { logUnexpectedError } from '@api/core/observability/errors'
import type { JobDeps, JobResult, WorkspaceWork } from '@api/jobs/jobs.types'
import { listJobWorkspaceIds } from '@api/modules/workspaces'

export async function forEachWorkspace(deps: JobDeps, work: WorkspaceWork): Promise<JobResult> {
  const workspaceIds = await listJobWorkspaceIds(deps.db)
  let failedWorkspaces = 0
  for (const workspaceId of workspaceIds) {
    try {
      await work(workspaceId)
    } catch (err) {
      failedWorkspaces += 1
      logUnexpectedError(
        deps.logger,
        { event: 'job.workspace.failed', module: 'jobs', workspaceId },
        err,
        'Job failed for a workspace',
      )
    }
  }
  return { workspaces: workspaceIds.length - failedWorkspaces, failedWorkspaces }
}
