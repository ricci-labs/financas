const SECONDS_PER_MINUTE = 60
const PAD_LENGTH = 2

export function formatSeconds(totalSeconds: number): string {
  return `${wholeSeconds(totalSeconds)} s`
}

export function formatMinutesAndSeconds(totalSeconds: number): string {
  const seconds = wholeSeconds(totalSeconds)
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE)
  const rest = String(seconds % SECONDS_PER_MINUTE).padStart(PAD_LENGTH, '0')
  return `${minutes}:${rest}`
}

function wholeSeconds(totalSeconds: number): number {
  return Math.max(0, Math.ceil(totalSeconds))
}
