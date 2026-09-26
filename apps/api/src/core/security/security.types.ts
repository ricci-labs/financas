export type PasswordCost = {
  cpuMemoryCost: number
  blockSize: number
  parallelization: number
}

export type AttemptLimiterOptions = {
  maxAttempts: number
  windowMs: number
  maxTrackedKeys?: number
  now?: () => number
}

export type AttemptCheck = {
  isBlocked: boolean
  retryAfterSeconds: number
}

export type AttemptLimiter = {
  check: (key: string) => AttemptCheck
  record: (key: string) => void
  clear: (key: string) => void
}

export type Window = {
  attempts: number
  startedAt: number
}
