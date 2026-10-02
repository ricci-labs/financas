import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBaseApp } from '@api/core/http/base-app'
import { createWebApp, routeByPath } from '@api/core/http/web-app'
import { createCapturingLogger } from '@api/testing/logger'
import { afterAll, describe, expect, it } from 'vitest'

const INDEX_HTML = '<!doctype html><div id="root"></div>'
const ASSET_JS = 'console.log(1)'
const SECRET = 'outside the build'
const parentDir = mkdtempSync(join(tmpdir(), 'web-parent-'))
const webDistDir = join(parentDir, 'dist')
mkdirSync(webDistDir)
writeFileSync(join(parentDir, 'secret.txt'), SECRET)
mkdirSync(join(webDistDir, 'assets'))
mkdirSync(join(webDistDir, 'email'))
writeFileSync(join(webDistDir, 'index.html'), INDEX_HTML)
writeFileSync(join(webDistDir, 'theme-init.js'), 'void 0')
writeFileSync(join(webDistDir, 'assets', 'index-abc123.js'), ASSET_JS)
writeFileSync(join(webDistDir, 'email', 'owl-key.png'), 'png')

const logger = createCapturingLogger('info').logger
const api = createBaseApp(logger)
  .get('/api/health/live', (c) => c.json({ status: 'live' }))
  .get('/api/attachments/file', (c) => {
    c.header('Content-Security-Policy', 'sandbox')
    return c.body('file')
  })
const web = createWebApp(logger, webDistDir)
const NODE_BINDINGS = {} as never
const fetchAny = routeByPath(api.fetch, web.fetch)
const app = {
  request: (path: string) =>
    Promise.resolve(fetchAny(new Request(`http://app.test${path}`), NODE_BINDINGS)),
}

afterAll(() => {
  rmSync(parentDir, { recursive: true, force: true })
})

describe('the web app next to the API', () => {
  it('serves hashed assets for a year, as immutable', async () => {
    const response = await app.request('/assets/index-abc123.js')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(ASSET_JS)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })

  it('serves the page and other files so the browser checks them again', async () => {
    for (const path of ['/', '/theme-init.js', '/email/owl-key.png']) {
      const response = await app.request(path)
      expect(response.status, path).toBe(200)
      expect(response.headers.get('Cache-Control'), path).toBe('no-cache')
    }
  })

  it('answers any page of the app with index.html', async () => {
    const response = await app.request('/login?next=%2F')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(INDEX_HTML)
  })

  it('answers a missing file with 404, never with the page', async () => {
    for (const path of ['/assets/index-gone.js', '/missing.png']) {
      const response = await app.request(path)
      expect(response.status, path).toBe(404)
      expect(response.headers.get('Cache-Control'), path).toBeNull()
    }
  })

  it('leaves the API alone: its routes answer, unknown ones are ROUTE_NOT_FOUND', async () => {
    expect(await (await app.request('/api/health/live')).json()).toEqual({ status: 'live' })
    const unknown = await app.request('/api/does-not-exist')
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toMatchObject({ error: { code: 'ROUTE_NOT_FOUND' } })
  })

  it('never serves files outside the build folder', async () => {
    for (const path of ['/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt']) {
      const response = await app.request(path)
      expect(await response.text(), path).not.toContain(SECRET)
    }
  })

  it('keeps the API answers out of the page policy, so a route can sandbox its own content', async () => {
    const download = await app.request('/api/attachments/file')
    expect(download.headers.get('Content-Security-Policy')).toBe('sandbox')
  })

  it('sends a strict Content-Security-Policy with every page and file', async () => {
    const policy = (await app.request('/')).headers.get('Content-Security-Policy') ?? ''
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain('unsafe-inline')
  })
})
