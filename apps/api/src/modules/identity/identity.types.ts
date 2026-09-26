import type { BackgroundTasks } from '@api/core/background-tasks.types'
import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import type { Mailer } from '@api/core/email/email.types'
import type { SessionCookieSettings } from '@api/core/http/http.types'
import type { AttemptLimiter, PasswordCost } from '@api/core/security/security.types'

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
  loginLimits: LoginLimits
  accountEmailLimits: AccountEmailLimits
  trustedProxyHops: number
  background: BackgroundTasks
}

export type LinkLimitDeps = Pick<IdentityRouteDeps, 'accountEmailLimits' | 'trustedProxyHops'>

export type AccountEmailLimits = {
  byEmail: AttemptLimiter
  byClient: AttemptLimiter
  invalidLinksByClient: AttemptLimiter
}

export type AccountEmailLimitSettings = {
  maxPerEmailPerHour: number
  maxPerClientPerHour: number
  maxInvalidLinksPerClientPerHour: number
}

export type LoginLimits = {
  byEmail: AttemptLimiter
  byClient: AttemptLimiter
}

export type LoginLimitSettings = {
  maxFailuresPerEmail: number
  maxFailuresPerClient: number
  windowMinutes: number
}

export type VerificationEmail = {
  recipient: EmailRecipient
  verifyLink: string
}

export type PasswordResetEmail = {
  recipient: EmailRecipient
  resetLink: string
}

export type PasswordChangedEmail = {
  recipient: EmailRecipient
  forgotPasswordLink: string
}

export type AccountExistsEmail = {
  recipient: EmailRecipient
  loginLink: string
  forgotPasswordLink: string
}

export type EmailBody = { in: { json: { email: string } }; out: { json: { email: string } } }

export type LimitKeys = {
  email: string
  client: string
}

export type UserRow = {
  email: string
  displayName: string
  passwordHash: string
  emailVerifiedAt: Date | null
}

export type AuthTokenRow = {
  userId: string
  purpose: AuthTokenPurpose
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}

export type SessionRow = {
  userId: string
  tokenHash: string
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

export type PasswordChangeInput = {
  userId: string
  sessionId: string
  currentPassword: string
  newPassword: string
}

export type UserPreferences = {
  language: string
  quietHoursStart: string | null
  quietHoursEnd: string | null
}

export type UserPreferencesUpdate = Partial<UserPreferences>
