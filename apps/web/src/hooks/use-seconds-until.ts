import { useSyncExternalStore } from 'react'

const TICK_MS = 1000
const MS_PER_SECOND = 1000

function subscribeToSeconds(onTick: () => void): () => void {
  const timer = setInterval(onTick, TICK_MS)
  return () => clearInterval(timer)
}

function currentSecond(): number {
  return Math.ceil(Date.now() / MS_PER_SECOND)
}

export function useSecondsUntil(untilMs: number | null): number {
  const nowSecond = useSyncExternalStore(subscribeToSeconds, currentSecond)
  if (untilMs === null) {
    return 0
  }
  return Math.max(0, Math.ceil(untilMs / MS_PER_SECOND) - nowSecond)
}
