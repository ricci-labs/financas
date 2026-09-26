import { createApp, PUBLIC_ROUTES } from '@api/app'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { describe, expect, it } from 'vitest'

const MIDDLEWARE_METHOD = 'ALL'
const FOREIGN_ORIGIN = 'https://evil.example.test'

function registeredRoutes() {
  const app = createApp(testAppDeps())
  return app.routes
    .filter((route) => route.method !== MIDDLEWARE_METHOD)
    .map((route) => ({ method: route.method, path: route.path }))
}

function concretePath(path: string): string {
  return path.replaceAll(/:\w+/g, 'some-id')
}

describe('route protection', () => {
  it('asks for a session on every route that is not declared public', async () => {
    const app = createApp(testAppDeps())
    const privateRoutes = registeredRoutes().filter(
      ({ method, path }) => !PUBLIC_ROUTES.has(`${method} ${path}`),
    )
    expect(privateRoutes.length).toBeGreaterThan(0)

    for (const { method, path } of privateRoutes) {
      const response = await app.request(concretePath(path), {
        method,
        headers: { Origin: TEST_PUBLIC_URL },
      })
      expect({ route: `${method} ${path}`, status: response.status }).toEqual({
        route: `${method} ${path}`,
        status: 401,
      })
    }
  })

  it('blocks a route whose handler forgets to check the session', async () => {
    const app = createApp(testAppDeps()).get('/api/forgetful', (c) => c.text('reached'))
    const response = await app.request('/api/forgetful')
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: { code: 'SESSION_REQUIRED' } })
  })

  it('declares as public only routes that exist', () => {
    const existing = new Set(registeredRoutes().map(({ method, path }) => `${method} ${path}`))
    for (const publicRoute of PUBLIC_ROUTES) {
      expect(existing).toContain(publicRoute)
    }
  })
})

describe('writes from other sites', () => {
  it('are refused without proof that they come from the app', async () => {
    const app = createApp(testAppDeps())
    const attempts = [{}, { Origin: FOREIGN_ORIGIN }, { 'Sec-Fetch-Site': 'cross-site' }]
    for (const headers of attempts) {
      const response = await app.request('/api/auth/logout', { method: 'POST', headers })
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ error: { code: 'CROSS_SITE_REQUEST' } })
    }
  })

  it('are accepted from the app origin or a same-origin fetch', async () => {
    const app = createApp(testAppDeps())
    for (const headers of [{ Origin: TEST_PUBLIC_URL }, { 'Sec-Fetch-Site': 'same-origin' }]) {
      const response = await app.request('/api/auth/logout', { method: 'POST', headers })
      expect(response.status).toBe(204)
    }
  })

  it('do not affect reads', async () => {
    const response = await createApp(testAppDeps()).request('/api/auth/config')
    expect(response.status).toBe(200)
  })
})
