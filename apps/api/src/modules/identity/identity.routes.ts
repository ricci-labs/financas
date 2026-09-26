import { clientIpOf } from '@api/core/http/client-ip'
import { TooManyRequestsError, UnauthorizedError } from '@api/core/http/errors'
import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from '@api/core/http/session-cookie'
import { jsonBody } from '@api/core/http/validation'
import { createAttemptLimiter } from '@api/core/security/attempt-limiter'
import { getAccount, login, logout } from '@api/modules/identity/identity.service'
import type {
  IdentityRouteDeps,
  LoginLimitSettings,
  LoginLimits,
} from '@api/modules/identity/identity.types'
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@financas/shared'
import { type Context, Hono } from 'hono'
import { z } from 'zod'

const loginBodySchema = z.object({
  email: z.string().max(EMAIL_MAX_LENGTH),
  password: z.string().max(PASSWORD_MAX_LENGTH),
})

const MS_PER_MINUTE = 60 * 1000
const RETRY_AFTER_HEADER = 'Retry-After'

export const PUBLIC_AUTH_ROUTES = [
  'GET /api/auth/config',
  'POST /api/auth/login',
  'POST /api/auth/logout',
] as const

export function identityRoutes(deps: IdentityRouteDeps) {
  return new Hono<AppEnv>()
    .get('/config', (c) => c.json({ isSignupEnabled: deps.isPublicSignupEnabled }))
    .post('/login', jsonBody(loginBodySchema, 'LOGIN_INVALID'), async (c) => {
      const credentials = c.req.valid('json')
      const keys = limitKeys(c, deps, credentials.email)
      refuseWhileLimited(c, deps.loginLimits, keys)
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
    .get('/me', async (c) => {
      const { userId } = currentSession(c)
      return c.json(await getAccount(deps.db, userId))
    })
}

export function createLoginLimits(settings: LoginLimitSettings): LoginLimits {
  const windowMs = settings.windowMinutes * MS_PER_MINUTE
  return {
    byEmail: createAttemptLimiter({ maxFailures: settings.maxFailuresPerEmail, windowMs }),
    byClient: createAttemptLimiter({ maxFailures: settings.maxFailuresPerClient, windowMs }),
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

function refuseWhileLimited(c: Context<AppEnv>, limits: LoginLimits, keys: LimitKeys): void {
  const byEmail = limits.byEmail.check(keys.email)
  const byClient = limits.byClient.check(keys.client)
  if (!byEmail.isBlocked && !byClient.isBlocked) {
    return
  }

  const retryAfterSeconds = Math.max(byEmail.retryAfterSeconds, byClient.retryAfterSeconds)
  c.header(RETRY_AFTER_HEADER, String(retryAfterSeconds))
  c.get('logger').warn(
    { event: 'auth.login.rate_limited', byEmail: byEmail.isBlocked, byClient: byClient.isBlocked },
    'Login attempts limited',
  )
  throw new TooManyRequestsError('TOO_MANY_ATTEMPTS', 'Too many failed attempts, try again later')
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
      limits.byEmail.recordFailure(keys.email)
      limits.byClient.recordFailure(keys.client)
    }
    throw error
  }
}
