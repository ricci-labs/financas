import type { Logger } from '@api/core/observability/logger'

export type BackgroundTasks = {
  run: (logger: Logger, task: string, work: () => Promise<unknown>) => void
  idle: () => Promise<void>
}
