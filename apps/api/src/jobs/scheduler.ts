import type { ScheduledJob, Scheduler, SchedulerDeps } from '@api/jobs/jobs.types'
import { Cron } from 'croner'

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
  const logger = deps.logger.child({ job: job.name })
  const startedAt = performance.now()
  const durationMs = () => Math.round(performance.now() - startedAt)
  logger.info({ event: 'job.run.started' }, 'Job started')
  try {
    const result = await job.run(deps)
    logger.info({ event: 'job.run.completed', durationMs: durationMs(), result }, 'Job completed')
  } catch (err) {
    logger.error({ event: 'job.run.failed', durationMs: durationMs(), err }, 'Job failed')
  }
}
