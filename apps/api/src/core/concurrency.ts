import type { ConcurrencyLimit } from '@api/core/concurrency.types'

export function createConcurrencyLimit(maxRunning: number): ConcurrencyLimit {
  let running = 0
  const waiting: Array<() => void> = []

  function acquireSlot(): Promise<void> {
    if (running < maxRunning) {
      running += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => waiting.push(resolve))
  }

  function releaseSlot(): void {
    const next = waiting.shift()
    if (next) {
      next()
      return
    }
    running -= 1
  }

  return async function runLimited<T>(work: () => Promise<T>): Promise<T> {
    await acquireSlot()
    try {
      return await work()
    } finally {
      releaseSlot()
    }
  }
}
