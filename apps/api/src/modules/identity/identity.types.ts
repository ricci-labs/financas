import type { Clock } from '@api/core/clock'
import type { PasswordCost } from '@api/core/security/passwords'

export type IdentityDeps = {
  clock: Clock
  passwordCost: PasswordCost
}

export type NewUserInput = {
  email: string
  displayName: string
  password: string
  isEmailVerified: boolean
}

export type LoginInput = {
  email: string
  password: string
  userAgent?: string
}

export type StartedSession = {
  userId: string
  token: string
  expiresAt: Date
}

export type ActiveSession = {
  sessionId: string
  userId: string
  expiresAt: Date
  isRenewed: boolean
}
