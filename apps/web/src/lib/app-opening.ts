const OPENING_HOLD_MS = 1200
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export function createOpeningPause(now: () => number = () => performance.now()) {
  const openedAt = now()
  let hasPaused = false
  return function waitForOpening(): Promise<void> {
    if (hasPaused) {
      return Promise.resolve()
    }
    hasPaused = true
    const left = openingHoldMs() - (now() - openedAt)
    return left > 0 ? new Promise((resolve) => setTimeout(resolve, left)) : Promise.resolve()
  }
}

function openingHoldMs(): number {
  return window.matchMedia(REDUCED_MOTION).matches ? 0 : OPENING_HOLD_MS
}
