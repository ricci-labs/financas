import type { LocalClock, QuietHours } from '@shared/identity/notifications/notifications.types'

const MINUTES_PER_HOUR = 60
const MS_PER_MINUTE = 60_000
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

export function outsideQuietHours(instant: Date, timeZone: string, quiet: QuietHours | null): Date {
  if (!quiet) {
    return instant
  }
  const start = minutesOf(quiet.start)
  const end = minutesOf(quiet.end)
  const local = localClock(instant, timeZone)
  const wraps = start > end
  const isQuiet = wraps
    ? local.minutes >= start || local.minutes < end
    : local.minutes >= start && local.minutes < end
  if (start === end || !isQuiet) {
    return instant
  }
  const daysAhead = wraps && local.minutes >= start ? 1 : 0
  const wakeLocalMs = local.midnightUtcMs + (daysAhead * MINUTES_PER_DAY + end) * MS_PER_MINUTE
  return new Date(wakeLocalMs - offsetMs(new Date(wakeLocalMs), timeZone))
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * MINUTES_PER_HOUR + (minutes ?? 0)
}

function localClock(instant: Date, timeZone: string): LocalClock {
  const localMs = instant.getTime() + offsetMs(instant, timeZone)
  const local = new Date(localMs)
  const minutes = local.getUTCHours() * MINUTES_PER_HOUR + local.getUTCMinutes()
  return {
    minutes,
    midnightUtcMs:
      localMs -
      (minutes * MS_PER_MINUTE + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds()),
  }
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds())
}
