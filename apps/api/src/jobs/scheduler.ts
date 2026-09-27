import { logUnexpectedError } from '@api/core/observability/errors'
import { appMetrics } from '@api/core/observability/metrics'
import { newTraceId, runInOperation } from '@api/core/observability/operation-context'
import type { ScheduledJob, Scheduler, SchedulerDeps } from '@api/jobs/jobs.types'
import { Cron } from 'croner'

const MS_PER_SECOND = 1000

export function startScheduler(jobs: readonly ScheduledJob[], deps: SchedulerDeps): Scheduler {
  const running = new Set<Promise<void>>()
  const track = (run: Promise<void>) => {
    running.add(run)
    return run.finally(() => running.delete(run))
  }
  const crons = jobs.map(
    (job) =>
      new Cron(job.schedule, { name: job.name, timezone: deps.timezone, protect: true }, () =>
        track(runJob(job, deps)),
      ),
  )
  return {
    stop: async () => {
      for (const cron of crons) {
        cron.stop()
      }
      await Promise.all(running)
    },
  }
}

export async function runJob(job: ScheduledJob, deps: SchedulerDeps): Promise<void> {
  const traceId = newTraceId()
  const logger = deps.logger.child({ job: job.name, trace_id: traceId })
  const startedAt = performance.now()
  const durationMs = () => Math.round(performance.now() - startedAt)
  logger.info({ event: 'job.run.started' }, 'Job started')
  try {
    const result = await runInOperation({ traceId, source: 'job', actorUserId: null }, () =>
      job.run({ ...deps, logger }),
    )
    logger.info({ event: 'job.run.completed', durationMs: durationMs(), result }, 'Job completed')
    appMetrics().jobRuns.add(1, { job: job.name, outcome: 'ok' })
    appMetrics().jobLastSuccess.record(deps.clock.now().getTime() / MS_PER_SECOND, {
      job: job.name,
    })
  } catch (err) {
    logUnexpectedError(
      logger,
      { event: 'job.run.failed', module: 'jobs', durationMs: durationMs() },
      err,
      'Job failed',
    )
    appMetrics().jobRuns.add(1, { job: job.name, outcome: 'error' })
  }
}
