import { createConcurrencyLimit } from '@api/core/concurrency'
import { describe, expect, it } from 'vitest'

function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

describe('createConcurrencyLimit', () => {
  it('runs at most the given number of tasks at once, in arrival order', async () => {
    const runLimited = createConcurrencyLimit(2)
    const gates = [deferred(), deferred(), deferred(), deferred()]
    const started: number[] = []

    const tasks = gates.map((gate, index) =>
      runLimited(async () => {
        started.push(index)
        await gate.promise
        return index
      }),
    )

    await flushMicrotasks()
    expect(started).toEqual([0, 1])

    gates[1]?.resolve()
    await flushMicrotasks()
    expect(started).toEqual([0, 1, 2])

    gates[0]?.resolve()
    gates[2]?.resolve()
    gates[3]?.resolve()
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3])
  })

  it('frees the slot when a task fails', async () => {
    const runLimited = createConcurrencyLimit(1)
    const failing = runLimited(() => Promise.reject(new Error('boom')))
    await expect(failing).rejects.toThrow('boom')
    expect(await runLimited(async () => 'next')).toBe('next')
  })
})
