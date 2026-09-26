import type { Env } from '@api/core/config/env'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

export type SessionCookieSettings = {
  name: string
  isSecure: boolean
}

const PRODUCTION_COOKIE: SessionCookieSettings = { name: '__Host-session', isSecure: true }
const DEVELOPMENT_COOKIE: SessionCookieSettings = { name: 'session', isSecure: false }

export function sessionCookieSettings(nodeEnv: Env['NODE_ENV']): SessionCookieSettings {
  return nodeEnv === 'production' ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE
}

export function readSessionCookie(c: Context, settings: SessionCookieSettings): string | undefined {
  return getCookie(c, settings.name)
}

export function writeSessionCookie(
  c: Context,
  settings: SessionCookieSettings,
  token: string,
  expiresAt: Date,
): void {
  setCookie(c, settings.name, token, {
    httpOnly: true,
    secure: settings.isSecure,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context, settings: SessionCookieSettings): void {
  deleteCookie(c, settings.name, { httpOnly: true, secure: settings.isSecure, path: '/' })
}
