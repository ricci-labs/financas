import { ForbiddenError } from '@api/core/http/errors'
import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from '@api/core/http/session-cookie'
import { jsonBody } from '@api/core/http/validation'
import {
  limitAccountEmails,
  limitFailedLogins,
  limitInvalidLinks,
} from '@api/modules/identity/identity.middleware'
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
import type { IdentityRouteDeps } from '@api/modules/identity/identity.types'
import {
  emailRequestSchema,
  loginRequestSchema,
  newUserSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@financas/shared'
import { Hono } from 'hono'

const ACCEPTED = 202
const NO_CONTENT = 204

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
    .post(
      '/login',
      jsonBody(loginRequestSchema, 'LOGIN_INVALID'),
      limitFailedLogins(deps),
      async (c) => {
        const credentials = c.req.valid('json')
        const userAgent = c.req.header('User-Agent')
        const session = await login(deps.db, { ...credentials, userAgent })
        writeSessionCookie(c, deps.cookie, session.token, session.expiresAt)
        c.get('logger').info(
          { event: 'auth.login.succeeded', userId: session.userId },
          'User logged in',
        )
        return c.json({ userId: session.userId, expiresAt: session.expiresAt.toISOString() })
      },
    )
    .post('/logout', async (c) => {
      const token = readSessionCookie(c, deps.cookie)
      if (token) {
        await logout(deps.db, token)
      }
      clearSessionCookie(c, deps.cookie)
      return c.body(null, NO_CONTENT)
    })
    .post('/signup', jsonBody(newUserSchema, 'USER_INVALID'), limitAccountEmails(deps), (c) => {
      if (!deps.isPublicSignupEnabled) {
        throw new ForbiddenError('SIGNUP_DISABLED', 'Public sign-up is turned off')
      }
      const newUser = c.req.valid('json')
      deps.background.run(c.get('logger'), 'auth.sign_up', () => signUp(deps.db, newUser, deps))
      return c.body(null, ACCEPTED)
    })
    .post(
      '/verify-email/resend',
      jsonBody(emailRequestSchema, 'EMAIL_INVALID'),
      limitAccountEmails(deps),
      (c) => {
        const { email } = c.req.valid('json')
        deps.background.run(c.get('logger'), 'auth.email_verification_requested', () =>
          requestEmailVerification(deps.db, { email }, deps),
        )
        return c.body(null, ACCEPTED)
      },
    )
    .post(
      '/password/forgot',
      jsonBody(emailRequestSchema, 'EMAIL_INVALID'),
      limitAccountEmails(deps),
      (c) => {
        const { email } = c.req.valid('json')
        deps.background.run(c.get('logger'), 'auth.password_reset_requested', () =>
          requestPasswordReset(deps.db, { email }, deps),
        )
        return c.body(null, ACCEPTED)
      },
    )
    .post(
      '/verify-email',
      jsonBody(verifyEmailRequestSchema, 'LINK_INVALID'),
      limitInvalidLinks(deps),
      async (c) => {
        await verifyEmail(deps.db, c.req.valid('json').token)
        return c.body(null, NO_CONTENT)
      },
    )
    .post(
      '/password/reset',
      jsonBody(resetPasswordRequestSchema, 'PASSWORD_INVALID'),
      limitInvalidLinks(deps),
      async (c) => {
        await resetPassword(deps.db, c.req.valid('json'), deps)
        clearSessionCookie(c, deps.cookie)
        return c.body(null, NO_CONTENT)
      },
    )
    .get('/me', async (c) => {
      const { userId } = currentSession(c)
      return c.json(await getAccount(deps.db, userId))
    })
}
