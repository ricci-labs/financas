import { UnauthorizedError } from '@api/core/http/errors'
import type { AppEnv, SessionGuardOptions } from '@api/core/http/http.types'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from '@api/core/http/session-cookie'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'

const LAST_MATCHED_ROUTE = -1

export function requireSession({ resolve, publicRoutes, cookie }: SessionGuardOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (publicRoutes.has(routeKeyOf(c))) {
      await next()
      return
    }

    const token = readSessionCookie(c, cookie)
    const session = token ? await resolve(token) : null
    if (!token || !session) {
      clearSessionCookie(c, cookie)
      throw new UnauthorizedError('SESSION_REQUIRED', 'Log in to continue')
    }

    if (session.isRenewed) {
      writeSessionCookie(c, cookie, token, session.expiresAt)
    }
    c.set('session', { sessionId: session.sessionId, userId: session.userId })
    await next()
  })
}

export function routeKeyOf(c: Context): string {
  return `${c.req.method} ${routePath(c, LAST_MATCHED_ROUTE)}`
}

export function currentSession(c: Context<AppEnv>) {
  const session = c.get('session')
  if (!session) {
    throw new UnauthorizedError('SESSION_REQUIRED', 'Log in to continue')
  }
  return session
}
