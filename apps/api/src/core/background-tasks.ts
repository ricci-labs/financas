import type { BackgroundTasks } from '@api/core/background-tasks.types'
import { logUnexpectedError } from '@api/core/observability/errors'
import type { Logger } from '@api/core/observability/logger'

export function createBackgroundTasks(): BackgroundTasks {
  const pending = new Set<Promise<void>>()

  function run(logger: Logger, task: string, work: () => Promise<unknown>): void {
    const running = work()
      .then(() => undefined)
      .catch((error: unknown) => {
        logUnexpectedError(
          logger,
          { event: 'background.task.failed', module: 'background', task },
          error,
          'Background task failed',
        )
      })
      .finally(() => pending.delete(running))
    pending.add(running)
  }

  async function idle(): Promise<void> {
    await Promise.all(pending)
  }

  return { run, idle }
}
