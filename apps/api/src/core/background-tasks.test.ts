import { createBackgroundTasks } from '@api/core/background-tasks'
import { createCapturingLogger } from '@api/testing/logger'
import { describe, expect, it } from 'vitest'

describe('createBackgroundTasks', () => {
  it('runs work without the caller waiting, and idle() waits for it', async () => {
    const tasks = createBackgroundTasks()
    const { logger } = createCapturingLogger()
    const done: string[] = []

    tasks.run(logger, 'slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      done.push('slow')
    })
    expect(done).toEqual([])

    await tasks.idle()
    expect(done).toEqual(['slow'])
  })

  it('logs a failure with the task name instead of losing it', async () => {
    const tasks = createBackgroundTasks()
    const { logger, entries } = createCapturingLogger()

    tasks.run(logger, 'auth.sign_up', async () => {
      throw new Error('smtp down')
    })
    await tasks.idle()

    expect(entries()).toEqual([
      expect.objectContaining({
        event: 'background.task.failed',
        task: 'auth.sign_up',
        err: expect.objectContaining({ message: 'smtp down' }),
      }),
    ])
  })
})
