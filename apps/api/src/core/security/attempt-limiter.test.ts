import { createAttemptLimiter } from '@api/core/security/attempt-limiter'
import { describe, expect, it } from 'vitest'

const WINDOW_MS = 15 * 60 * 1000

function limiterAt(startMs = 0, maxTrackedKeys?: number) {
  let currentMs = startMs
  const limiter = createAttemptLimiter({
    maxFailures: 3,
    windowMs: WINDOW_MS,
    maxTrackedKeys,
    now: () => currentMs,
  })
  return {
    limiter,
    advance: (ms: number) => {
      currentMs += ms
    },
  }
}

function failTimes(limiter: ReturnType<typeof limiterAt>['limiter'], key: string, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    limiter.recordFailure(key)
  }
}

describe('createAttemptLimiter', () => {
  it('blocks a key after the maximum failures, and only that key', () => {
    const { limiter } = limiterAt()
    failTimes(limiter, 'email:a', 2)
    expect(limiter.check('email:a').isBlocked).toBe(false)
    limiter.recordFailure('email:a')
    expect(limiter.check('email:a')).toEqual({ isBlocked: true, retryAfterSeconds: 900 })
    expect(limiter.check('email:b').isBlocked).toBe(false)
  })

  it('tells how long to wait and lets the key in again when the window ends', () => {
    const { limiter, advance } = limiterAt()
    failTimes(limiter, 'ip:1', 3)
    advance(WINDOW_MS - 61_000)
    expect(limiter.check('ip:1')).toEqual({ isBlocked: true, retryAfterSeconds: 61 })
    advance(61_000)
    expect(limiter.check('ip:1').isBlocked).toBe(false)
  })

  it('starts counting again after a window ends', () => {
    const { limiter, advance } = limiterAt()
    failTimes(limiter, 'ip:1', 2)
    advance(WINDOW_MS)
    failTimes(limiter, 'ip:1', 2)
    expect(limiter.check('ip:1').isBlocked).toBe(false)
  })

  it('forgets a key when cleared', () => {
    const { limiter } = limiterAt()
    failTimes(limiter, 'email:a', 3)
    limiter.clear('email:a')
    expect(limiter.check('email:a').isBlocked).toBe(false)
  })

  it('keeps memory bounded by dropping the oldest keys first', () => {
    const { limiter } = limiterAt(0, 2)
    failTimes(limiter, 'oldest', 3)
    failTimes(limiter, 'middle', 3)
    failTimes(limiter, 'newest', 3)
    expect(limiter.check('oldest').isBlocked).toBe(false)
    expect(limiter.check('middle').isBlocked).toBe(true)
    expect(limiter.check('newest').isBlocked).toBe(true)
  })
})
