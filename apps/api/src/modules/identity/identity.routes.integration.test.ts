import { createApp } from '@api/app'
import { sessionCookieSettings } from '@api/core/http/session-cookie'
import { createUser } from '@api/modules/identity'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const PASSWORD = 'a long enough password'
const FAST_COST = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const SESSION_COOKIE = /^session=([\w-]{43});/

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function appFor(overrides: Parameters<typeof testAppDeps>[0] = {}) {
  return createApp(testAppDeps({ db: databases.app, ...overrides }))
}

async function existingUser(label: string) {
  const email = `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
  const userId = await createUser(
    databases.app,
    { email, displayName: `Member ${label}`, password: PASSWORD, isEmailVerified: true },
    { passwordCost: FAST_COST },
  )
  return { userId, email }
}

function postJson(app: ReturnType<typeof appFor>, path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: TEST_PUBLIC_URL,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function loggedIn(app: ReturnType<typeof appFor>, email: string) {
  const response = await postJson(app, '/api/auth/login', { email, password: PASSWORD })
  const token = response.headers.get('Set-Cookie')?.match(SESSION_COOKIE)?.[1]
  if (!token) {
    throw new Error('Login did not set the session cookie')
  }
  return { response, cookie: `session=${token}` }
}

describe('POST /api/auth/login', () => {
  it('sets an HttpOnly, SameSite=Lax session cookie and answers with the user id', async () => {
    const { userId, email } = await existingUser('route-login')
    const { response } = await loggedIn(appFor(), email)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ userId })
    const setCookie = response.headers.get('Set-Cookie') ?? ''
    expect(setCookie).toMatch(SESSION_COOKIE)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Expires=')
  })

  it('uses a Secure __Host- cookie in production', async () => {
    const { email } = await existingUser('route-production')
    const app = appFor({ cookie: sessionCookieSettings('production') })
    const response = await postJson(app, '/api/auth/login', { email, password: PASSWORD })
    const setCookie = response.headers.get('Set-Cookie') ?? ''
    expect(setCookie).toMatch(/^__Host-session=[\w-]{43};/)
    expect(setCookie).toContain('Secure')
  })

  it('answers 401 without a cookie for a wrong password', async () => {
    const { email } = await existingUser('route-wrong')
    const response = await postJson(appFor(), '/api/auth/login', {
      email,
      password: 'not the password',
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } })
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })
})

describe('GET /api/auth/me', () => {
  it('returns the logged-in account without any password data', async () => {
    const { userId, email } = await existingUser('route-me')
    const app = appFor()
    const { cookie } = await loggedIn(app, email)

    const response = await app.request('/api/auth/me', { headers: { Cookie: cookie } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ userId, email, displayName: 'Member route-me' })
  })

  it('answers 401 and clears a cookie that holds no valid session', async () => {
    const response = await appFor().request('/api/auth/me', {
      headers: { Cookie: 'session=not-a-real-session-token' },
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: { code: 'SESSION_REQUIRED' } })
    expect(response.headers.get('Set-Cookie')).toMatch(/^session=;.*Max-Age=0/)
  })
})

describe('POST /api/auth/logout', () => {
  it('ends the session, so the same cookie no longer works', async () => {
    const { email } = await existingUser('route-logout')
    const app = appFor()
    const { cookie } = await loggedIn(app, email)

    const logout = await postJson(app, '/api/auth/logout', {}, cookie)
    expect(logout.status).toBe(204)
    expect(logout.headers.get('Set-Cookie')).toMatch(/^session=;.*Max-Age=0/)

    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } })
    expect(me.status).toBe(401)
  })
})

describe('GET /api/auth/config', () => {
  it('tells the web whether public sign-up is on', async () => {
    const closed = await appFor({ isPublicSignupEnabled: false }).request('/api/auth/config')
    const open = await appFor({ isPublicSignupEnabled: true }).request('/api/auth/config')
    expect(await closed.json()).toEqual({ isSignupEnabled: false })
    expect(await open.json()).toEqual({ isSignupEnabled: true })
  })
})
