import { createOpeningPause } from '@web/lib/app-opening'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('createOpeningPause', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('holds the first opening until 1.2 s, then never again', async () => {
    let clock = 0
    const waitForOpening = createOpeningPause(() => clock)
    clock = 300
    let isDone = false
    void waitForOpening().then(() => {
      isDone = true
    })
    await vi.advanceTimersByTimeAsync(899)
    expect(isDone).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(isDone).toBe(true)
    await expect(waitForOpening()).resolves.toBeUndefined()
  })

  it('never holds once 1.2 s have passed', async () => {
    let clock = 0
    const waitForOpening = createOpeningPause(() => clock)
    clock = 1500
    await expect(waitForOpening()).resolves.toBeUndefined()
  })

  it('never holds with reduced motion', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const waitForOpening = createOpeningPause(() => 0)
    await expect(waitForOpening()).resolves.toBeUndefined()
  })
})
