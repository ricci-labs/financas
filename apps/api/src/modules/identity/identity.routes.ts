import { clientIpOf } from '@api/core/http/client-ip'
import {
  AppError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '@api/core/http/errors'
import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from '@api/core/http/session-cookie'
import { jsonBody } from '@api/core/http/validation'
import { createAttemptLimiter } from '@api/core/security/attempt-limiter'
import {
  getAccount,
  login,
  logout,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  signUp,
  verifyEmail,
} from '@api/modules/identity/identity.service'
import type {
  AccountEmailLimitSettings,
  AccountEmailLimits,
  IdentityRouteDeps,
  LoginLimitSettings,
  LoginLimits,
} from '@api/modules/identity/identity.types'
import { EMAIL_MAX_LENGTH, emailSchema, newUserSchema, PASSWORD_MAX_LENGTH } from '@financas/shared'
import { type Context, Hono } from 'hono'
import { z } from 'zod'

const loginBodySchema = z.object({
  email: z.string().max(EMAIL_MAX_LENGTH),
  password: z.string().max(PASSWORD_MAX_LENGTH),
})

const emailOnlyBodySchema = z.object({ email: emailSchema })
const TOKEN_MAX_LENGTH = 128
const tokenSchema = z.string().min(1).max(TOKEN_MAX_LENGTH)
const verifyEmailBodySchema = z.object({ token: tokenSchema })
const resetPasswordBodySchema = z.object({
  token: tokenSchema,
  password: z.string().max(PASSWORD_MAX_LENGTH),
})
const INVALID_LINK_CODE = 'LINK_INVALID'
const NO_CONTENT = 204

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const ACCEPTED = 202
const RETRY_AFTER_HEADER = 'Retry-After'

export const PUBLIC_AUTH_ROUTES = [
  'GET /api/auth/config',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/signup',
  'POST /api/auth/verify-email/resend',
  'POST /api/auth/password/forgot',
  'POST /api/auth/verify-email',
  'POST /api/auth/password/reset',
] as const

export function identityRoutes(deps: IdentityRouteDeps) {
  return new Hono<AppEnv>()
    .get('/config', (c) => c.json({ isSignupEnabled: deps.isPublicSignupEnabled }))
    .post('/login', jsonBody(loginBodySchema, 'LOGIN_INVALID'), async (c) => {
      const credentials = c.req.valid('json')
      const keys = limitKeys(c, deps, credentials.email)
      refuseWhileLimited(c, deps.loginLimits, keys, 'auth.login.rate_limited')
      const session = await countingFailures(deps.loginLimits, keys, () =>
        login(deps.db, { ...credentials, userAgent: c.req.header('User-Agent') }),
      )
      writeSessionCookie(c, deps.cookie, session.token, session.expiresAt)
      c.get('logger').info(
        { event: 'auth.login.succeeded', userId: session.userId },
        'User logged in',
      )
      return c.json({ userId: session.userId, expiresAt: session.expiresAt.toISOString() })
    })
    .post('/logout', async (c) => {
      const token = readSessionCookie(c, deps.cookie)
      if (token) {
        await logout(deps.db, token)
      }
      clearSessionCookie(c, deps.cookie)
      return c.body(null, 204)
    })
    .post('/signup', jsonBody(newUserSchema, 'USER_INVALID'), (c) => {
      if (!deps.isPublicSignupEnabled) {
        throw new ForbiddenError('SIGNUP_DISABLED', 'Public sign-up is turned off')
      }
      const newUser = c.req.valid('json')
      limitAccountEmails(c, deps, newUser.email)
      deps.background.run(c.get('logger'), 'auth.sign_up', () => signUp(deps.db, newUser, deps))
      return c.body(null, ACCEPTED)
    })
    .post('/verify-email/resend', jsonBody(emailOnlyBodySchema, 'EMAIL_INVALID'), (c) => {
      const { email } = c.req.valid('json')
      limitAccountEmails(c, deps, email)
      deps.background.run(c.get('logger'), 'auth.email_verification_requested', () =>
        requestEmailVerification(deps.db, { email }, deps),
      )
      return c.body(null, ACCEPTED)
    })
    .post('/password/forgot', jsonBody(emailOnlyBodySchema, 'EMAIL_INVALID'), (c) => {
      const { email } = c.req.valid('json')
      limitAccountEmails(c, deps, email)
      deps.background.run(c.get('logger'), 'auth.password_reset_requested', () =>
        requestPasswordReset(deps.db, { email }, deps),
      )
      return c.body(null, ACCEPTED)
    })
    .post('/verify-email', jsonBody(verifyEmailBodySchema, 'LINK_INVALID'), async (c) => {
      const { token } = c.req.valid('json')
      await countingInvalidLinks(c, deps, () => verifyEmail(deps.db, token))
      return c.body(null, NO_CONTENT)
    })
    .post('/password/reset', jsonBody(resetPasswordBodySchema, 'PASSWORD_INVALID'), async (c) => {
      const { token, password } = c.req.valid('json')
      await countingInvalidLinks(c, deps, () => resetPassword(deps.db, { token, password }, deps))
      clearSessionCookie(c, deps.cookie)
      return c.body(null, NO_CONTENT)
    })
    .get('/me', async (c) => {
      const { userId } = currentSession(c)
      return c.json(await getAccount(deps.db, userId))
    })
}

export function createLoginLimits(settings: LoginLimitSettings): LoginLimits {
  const windowMs = settings.windowMinutes * MS_PER_MINUTE
  return {
    byEmail: createAttemptLimiter({ maxAttempts: settings.maxFailuresPerEmail, windowMs }),
    byClient: createAttemptLimiter({ maxAttempts: settings.maxFailuresPerClient, windowMs }),
  }
}

export function createAccountEmailLimits(settings: AccountEmailLimitSettings): AccountEmailLimits {
  return {
    byEmail: createAttemptLimiter({
      maxAttempts: settings.maxPerEmailPerHour,
      windowMs: MS_PER_HOUR,
    }),
    byClient: createAttemptLimiter({
      maxAttempts: settings.maxPerClientPerHour,
      windowMs: MS_PER_HOUR,
    }),
    invalidLinksByClient: createAttemptLimiter({
      maxAttempts: settings.maxInvalidLinksPerClientPerHour,
      windowMs: MS_PER_HOUR,
    }),
  }
}

type LimitKeys = {
  email: string
  client: string
}

function limitKeys(c: Context, deps: IdentityRouteDeps, email: string): LimitKeys {
  return {
    email: email.trim().toLowerCase(),
    client: clientIpOf(c, deps.trustedProxyHops),
  }
}

function limitAccountEmails(c: Context<AppEnv>, deps: IdentityRouteDeps, email: string): void {
  const keys = limitKeys(c, deps, email)
  const limits = deps.accountEmailLimits
  refuseWhileLimited(c, limits, keys, 'auth.account_email.rate_limited')
  limits.byEmail.record(keys.email)
  limits.byClient.record(keys.client)
}

function refuseWhileLimited(
  c: Context<AppEnv>,
  limits: LoginLimits | AccountEmailLimits,
  keys: LimitKeys,
  event: string,
): void {
  const byEmail = limits.byEmail.check(keys.email)
  const byClient = limits.byClient.check(keys.client)
  if (!byEmail.isBlocked && !byClient.isBlocked) {
    return
  }

  const retryAfterSeconds = Math.max(byEmail.retryAfterSeconds, byClient.retryAfterSeconds)
  c.header(RETRY_AFTER_HEADER, String(retryAfterSeconds))
  c.get('logger').warn(
    { event, byEmail: byEmail.isBlocked, byClient: byClient.isBlocked },
    'Requests limited',
  )
  throw new TooManyRequestsError('TOO_MANY_ATTEMPTS', 'Too many attempts, try again later')
}

async function countingFailures<T>(
  limits: LoginLimits,
  keys: LimitKeys,
  attempt: () => Promise<T>,
): Promise<T> {
  try {
    const result = await attempt()
    limits.byEmail.clear(keys.email)
    return result
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      limits.byEmail.record(keys.email)
      limits.byClient.record(keys.client)
    }
    throw error
  }
}

async function countingInvalidLinks(
  c: Context<AppEnv>,
  deps: IdentityRouteDeps,
  useLink: () => Promise<void>,
): Promise<void> {
  const client = clientIpOf(c, deps.trustedProxyHops)
  const limiter = deps.accountEmailLimits.invalidLinksByClient
  const check = limiter.check(client)
  if (check.isBlocked) {
    c.header(RETRY_AFTER_HEADER, String(check.retryAfterSeconds))
    c.get('logger').warn({ event: 'auth.link.rate_limited' }, 'Invalid link attempts limited')
    throw new TooManyRequestsError('TOO_MANY_ATTEMPTS', 'Too many attempts, try again later')
  }

  try {
    await useLink()
  } catch (error) {
    if (error instanceof AppError && error.code === INVALID_LINK_CODE) {
      limiter.record(client)
    }
    throw error
  }
}
