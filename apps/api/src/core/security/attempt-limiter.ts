import type {
  AttemptCheck,
  AttemptLimiter,
  AttemptLimiterOptions,
} from '@api/core/security/security.types'

type Window = {
  attempts: number
  startedAt: number
}

const DEFAULT_MAX_TRACKED_KEYS = 10_000
const MS_PER_SECOND = 1000
const NOT_BLOCKED: AttemptCheck = { isBlocked: false, retryAfterSeconds: 0 }

export function createAttemptLimiter({
  maxAttempts,
  windowMs,
  maxTrackedKeys = DEFAULT_MAX_TRACKED_KEYS,
  now = Date.now,
}: AttemptLimiterOptions): AttemptLimiter {
  const windows = new Map<string, Window>()

  function openWindow(key: string): Window | undefined {
    const window = windows.get(key)
    if (window && now() - window.startedAt >= windowMs) {
      windows.delete(key)
      return undefined
    }
    return window
  }

  function check(key: string): AttemptCheck {
    const window = openWindow(key)
    if (!window || window.attempts < maxAttempts) {
      return NOT_BLOCKED
    }
    const remainingMs = window.startedAt + windowMs - now()
    return { isBlocked: true, retryAfterSeconds: Math.ceil(remainingMs / MS_PER_SECOND) }
  }

  function record(key: string): void {
    const window = openWindow(key)
    if (window) {
      window.attempts += 1
      return
    }
    windows.set(key, { attempts: 1, startedAt: now() })
    keepWithinCapacity()
  }

  function keepWithinCapacity(): void {
    if (windows.size <= maxTrackedKeys) {
      return
    }
    for (const key of windows.keys()) {
      openWindow(key)
    }
    for (const oldestKey of windows.keys()) {
      if (windows.size <= maxTrackedKeys) {
        return
      }
      windows.delete(oldestKey)
    }
  }

  return { check, record, clear: (key) => windows.delete(key) }
}
