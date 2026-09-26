import type { Database } from '@api/core/db/db.types'
import type { ScheduledJob, SchedulerDeps } from '@api/jobs/jobs.types'
import { SCHEDULE_TIMEZONE, SCHEDULED_JOBS } from '@api/jobs/scheduled-jobs'
import { runJob, startScheduler } from '@api/jobs/scheduler'
import { createCapturingLogger } from '@api/testing/logger'
import { afterEach, describe, expect, it, vi } from 'vitest'

const EVERY_SECOND = '* * * * * *'

function schedulerDeps() {
  const capturing = createCapturingLogger()
  const deps: SchedulerDeps = {
    db: {} as Database,
    clock: { now: () => new Date('2026-10-01T12:00:00Z') },
    logger: capturing.logger,
    timezone: SCHEDULE_TIMEZONE,
  }
  return { deps, entries: capturing.entries }
}

function job(run: ScheduledJob['run'], schedule = EVERY_SECOND): ScheduledJob {
  return { name: 'test-job', schedule, run }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('runJob', () => {
  it('logs the start and the result of a run', async () => {
    const { deps, entries } = schedulerDeps()
    await runJob(
      job(async () => ({ purged: 3 })),
      deps,
    )
    expect(entries()).toMatchObject([
      { event: 'job.run.started', job: 'test-job' },
      { event: 'job.run.completed', job: 'test-job', result: { purged: 3 } },
    ])
  })

  it('logs a failed run once and never throws, so the next run still happens', async () => {
    const { deps, entries } = schedulerDeps()
    const failing = job(async () => {
      throw new Error('database unreachable')
    })
    await expect(runJob(failing, deps)).resolves.toBeUndefined()
    expect(entries().at(-1)).toMatchObject({
      event: 'job.run.failed',
      err: { message: 'database unreachable' },
    })
  })
})

describe('startScheduler', () => {
  it('accepts every scheduled job, each with its own name', async () => {
    const names = SCHEDULED_JOBS.map((scheduled) => scheduled.name)
    expect(new Set(names).size).toBe(names.length)
    const scheduler = startScheduler(SCHEDULED_JOBS, schedulerDeps().deps)
    await scheduler.stop()
  })

  it('refuses a schedule that is not a cron pattern when starting', () => {
    const invalid = job(async () => ({}), 'every day')
    expect(() => startScheduler([invalid], schedulerDeps().deps)).toThrow()
  })

  it('runs on schedule and, when stopping, waits for the run in progress', async () => {
    vi.useFakeTimers()
    const { deps, entries } = schedulerDeps()
    let finishRun = () => {}
    const slow = job(
      () =>
        new Promise((resolve) => {
          finishRun = () => resolve({ done: 1 })
        }),
    )
    const scheduler = startScheduler([slow], deps)
    await vi.advanceTimersByTimeAsync(1_100)
    expect(entries().map((entry) => entry.event)).toEqual(['job.run.started'])

    let stopped = false
    const stopping = scheduler.stop().then(() => {
      stopped = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(stopped).toBe(false)

    finishRun()
    await stopping
    expect(entries().map((entry) => entry.event)).toEqual(['job.run.started', 'job.run.completed'])
  })
})
