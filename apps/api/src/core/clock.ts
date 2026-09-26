import type { Clock } from '@api/core/clock.types'

export const systemClock: Clock = {
  now: () => new Date(),
}
