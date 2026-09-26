import type { AppEnv } from '@api/core/http/http.types'
import { currentSession } from '@api/core/http/middleware/session'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from '@api/core/http/session-cookie'
import { jsonBody } from '@api/core/http/validation'
import { getAccount, login, logout } from '@api/modules/identity/identity.service'
import type { IdentityRouteDeps } from '@api/modules/identity/identity.types'
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@financas/shared'
import { Hono } from 'hono'
import { z } from 'zod'

const loginBodySchema = z.object({
  email: z.string().max(EMAIL_MAX_LENGTH),
  password: z.string().max(PASSWORD_MAX_LENGTH),
})

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
      const session = await login(deps.db, {
        ...credentials,
        userAgent: c.req.header('User-Agent'),
      })
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
