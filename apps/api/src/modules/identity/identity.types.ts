import type { Clock } from '@api/core/clock'
import type { Database } from '@api/core/db/client'
import type { Mailer } from '@api/core/email/email.types'
import type { SessionCookieSettings } from '@api/core/http/session-cookie'
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

export type AuthTokenPurpose = 'email_verification' | 'password_reset'

export type AccountEmailDeps = Partial<IdentityDeps> & {
  mailer: Mailer
  publicUrl: string
}

export type SignUpDeps = AccountEmailDeps & {
  isPublicSignupEnabled: boolean
}

export type SignUpInput = {
  email: string
  displayName: string
  password: string
}

export type EmailOnlyInput = {
  email: string
}

export type EmailRecipient = {
  userId: string
  email: string
  displayName: string
}

export type ResetPasswordInput = {
  token: string
  password: string
}

export type IdentityRouteDeps = {
  db: Database
  mailer: Mailer
  publicUrl: string
  isPublicSignupEnabled: boolean
  cookie: SessionCookieSettings
}
