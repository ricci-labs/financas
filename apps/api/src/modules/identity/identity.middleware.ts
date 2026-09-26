import { clientIpOf } from '@api/core/http/client-ip'
import { AppError, TooManyRequestsError, UnauthorizedError } from '@api/core/http/errors'
import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import { createAttemptLimiter } from '@api/core/security/attempt-limiter'
import type { AttemptLimiter } from '@api/core/security/security.types'
import type {
  AccountEmailLimitSettings,
  AccountEmailLimits,
  EmailBody,
  IdentityRouteDeps,
  LimitKeys,
  LinkLimitDeps,
  LoginLimitSettings,
  LoginLimits,
} from '@api/modules/identity/identity.types'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const RETRY_AFTER_HEADER = 'Retry-After'
const INVALID_LINK_CODE = 'LINK_INVALID'
const WRONG_CURRENT_PASSWORD_CODE = 'CURRENT_PASSWORD_WRONG'
const USER_KEY_PREFIX = 'user:'

export function createLoginLimits(settings: LoginLimitSettings): LoginLimits {
  const windowMs = settings.windowMinutes * MS_PER_MINUTE
  return {
    byEmail: createAttemptLimiter({ maxAttempts: settings.maxFailuresPerEmail, windowMs }),
    byClient: createAttemptLimiter({ maxAttempts: settings.maxFailuresPerClient, windowMs }),
  }
}

export function createAccountEmailLimits(settings: AccountEmailLimitSettings): AccountEmailLimits {
  return {
    byEmail: hourlyLimiter(settings.maxPerEmailPerHour),
    byClient: hourlyLimiter(settings.maxPerClientPerHour),
    invalidLinksByClient: hourlyLimiter(settings.maxInvalidLinksPerClientPerHour),
  }
}

export function limitFailedLogins(deps: IdentityRouteDeps) {
  return createMiddleware<AppEnv, string, EmailBody>(async (c, next) => {
    const keys = limitKeys(c, deps, c.req.valid('json').email)
    refuseWhileLimited(c, deps.loginLimits, keys, 'auth.login.rate_limited')
    await next()

    if (c.error instanceof UnauthorizedError) {
      deps.loginLimits.byEmail.record(keys.email)
      deps.loginLimits.byClient.record(keys.client)
      return
    }
    if (!c.error) {
      deps.loginLimits.byEmail.clear(keys.email)
    }
  })
}

export function limitAccountEmails(deps: IdentityRouteDeps) {
  return createMiddleware<AppEnv, string, EmailBody>(async (c, next) => {
    const keys = limitKeys(c, deps, c.req.valid('json').email)
    const limits = deps.accountEmailLimits
    refuseWhileLimited(c, limits, keys, 'auth.account_email.rate_limited')
    limits.byEmail.record(keys.email)
    limits.byClient.record(keys.client)
    await next()
  })
}

export function limitInvalidLinks(
  deps: LinkLimitDeps,
  invalidCodes: readonly string[] = [INVALID_LINK_CODE],
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const client = clientIpOf(c, deps.trustedProxyHops)
    const limiter = deps.accountEmailLimits.invalidLinksByClient
    const check = limiter.check(client)
    if (check.isBlocked) {
      refuse(c, check.retryAfterSeconds, { event: 'auth.link.rate_limited' })
    }
    await next()

    const isInvalidLink = c.error instanceof AppError && invalidCodes.includes(c.error.code)
    if (isInvalidLink) {
      limiter.record(client)
    }
  })
}

export function limitWrongCurrentPasswords(deps: IdentityRouteDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const keys = {
      email: `${USER_KEY_PREFIX}${currentSession(c).userId}`,
      client: clientIpOf(c, deps.trustedProxyHops),
    }
    refuseWhileLimited(c, deps.loginLimits, keys, 'auth.password_change.rate_limited')
    await next()

    const isWrongPassword =
      c.error instanceof AppError && c.error.code === WRONG_CURRENT_PASSWORD_CODE
    if (isWrongPassword) {
      deps.loginLimits.byEmail.record(keys.email)
      deps.loginLimits.byClient.record(keys.client)
      return
    }
    if (!c.error) {
      deps.loginLimits.byEmail.clear(keys.email)
    }
  })
}

function hourlyLimiter(maxAttempts: number): AttemptLimiter {
  return createAttemptLimiter({ maxAttempts, windowMs: MS_PER_HOUR })
}

function limitKeys(c: Context, deps: IdentityRouteDeps, email: string): LimitKeys {
  return {
    email: email.trim().toLowerCase(),
    client: clientIpOf(c, deps.trustedProxyHops),
  }
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
  refuse(c, retryAfterSeconds, { event, byEmail: byEmail.isBlocked, byClient: byClient.isBlocked })
}

function refuse(c: Context<AppEnv>, retryAfterSeconds: number, details: object): never {
  c.header(RETRY_AFTER_HEADER, String(retryAfterSeconds))
  c.get('logger').warn(details, 'Requests limited')
  throw new TooManyRequestsError('TOO_MANY_ATTEMPTS', 'Too many attempts, try again later')
}
