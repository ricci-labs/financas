import { createBaseApp, MAX_REQUEST_BODY_BYTES } from '@api/core/http/base-app'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@api/core/http/errors'
import { jsonBody } from '@api/core/http/validation'
import { createCapturingLogger } from '@api/testing/logger'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const INTERNAL_DETAIL = 'connection to 10.0.0.5 refused'
const REQUEST_ID = /^[0-9a-f]{32}$/

function testApp(level: 'info' | 'debug' = 'info') {
  const capture = createCapturingLogger(level)
  const app = createBaseApp(capture.logger)
    .get('/api/errors/validation', () => {
      throw new ValidationError('AMOUNT_INVALID', 'Amount must be positive')
    })
    .get('/api/errors/unauthorized', () => {
      throw new UnauthorizedError('INVALID_CREDENTIALS', 'Email or password is wrong')
    })
    .get('/api/errors/forbidden', () => {
      throw new ForbiddenError('SIGNUP_DISABLED', 'Public sign-up is turned off')
    })
    .get('/api/errors/not-found', () => {
      throw new NotFoundError('CARD_NOT_FOUND', 'Card not found')
    })
    .get('/api/errors/conflict', () => {
      throw new ConflictError('EMAIL_TAKEN', 'Another user has this email')
    })
    .get('/api/errors/unexpected', () => {
      throw new Error(INTERNAL_DETAIL)
    })
    .get('/api/items/:itemId', (c) => c.json({ itemId: c.req.param('itemId') }))
    .post(
      '/api/echo',
      jsonBody(z.object({ name: z.string().trim().min(1) }), 'ECHO_INVALID'),
      (c) => c.json(c.req.valid('json')),
    )
  return { app, ...capture }
}

async function errorOf(response: Response) {
  const body = (await response.json()) as { error: { code: string; message: string; ref: string } }
  return body.error
}

function postJson(app: ReturnType<typeof testApp>['app'], body: string) {
  return app.request('/api/echo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('error responses', () => {
  it.each([
    ['validation', 400, 'AMOUNT_INVALID'],
    ['unauthorized', 401, 'INVALID_CREDENTIALS'],
    ['forbidden', 403, 'SIGNUP_DISABLED'],
    ['not-found', 404, 'CARD_NOT_FOUND'],
    ['conflict', 409, 'EMAIL_TAKEN'],
  ])('maps a %s error to %i with its code and a ref', async (kind, status, code) => {
    const { app } = testApp()
    const response = await app.request(`/api/errors/${kind}`)
    expect(response.status).toBe(status)
    const error = await errorOf(response)
    expect(error.code).toBe(code)
    expect(error.ref).toBe(response.headers.get('X-Request-Id')?.slice(0, 8))
  })

  it('hides an unexpected error behind a ref and logs it once with the details', async () => {
    const { app, entries } = testApp()
    const response = await app.request('/api/errors/unexpected')

    expect(response.status).toBe(500)
    const error = await errorOf(response)
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Something went wrong' })
    expect(JSON.stringify(error)).not.toContain(INTERNAL_DETAIL)

    const failures = entries().filter((entry) => entry.event === 'http.request.failed')
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({
      level: 50,
      trace_id: response.headers.get('X-Request-Id'),
      err: { message: INTERNAL_DETAIL },
    })
  })

  it('answers an unknown route with ROUTE_NOT_FOUND', async () => {
    const { app } = testApp()
    const response = await app.request('/api/nothing-here')
    expect(response.status).toBe(404)
    expect((await errorOf(response)).code).toBe('ROUTE_NOT_FOUND')
  })
})

describe('request bodies', () => {
  it('passes the parsed body to the handler', async () => {
    const { app } = testApp()
    const response = await postJson(app, JSON.stringify({ name: '  Member A ' }))
    expect(await response.json()).toEqual({ name: 'Member A' })
  })

  it('refuses a body that fails the schema with the route code', async () => {
    const { app } = testApp()
    const response = await postJson(app, JSON.stringify({ name: '' }))
    expect(response.status).toBe(400)
    expect((await errorOf(response)).code).toBe('ECHO_INVALID')
  })

  it('refuses malformed JSON', async () => {
    const { app } = testApp()
    const response = await postJson(app, '{"name":')
    expect(response.status).toBe(400)
    expect((await errorOf(response)).code).toBe('BAD_REQUEST')
  })

  it('refuses a body larger than 100 KB before reading it', async () => {
    const { app } = testApp()
    const oversized = JSON.stringify({ name: 'x'.repeat(MAX_REQUEST_BODY_BYTES) })
    const response = await postJson(app, oversized)
    expect(response.status).toBe(413)
    expect((await errorOf(response)).code).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('request context', () => {
  it('gives every request a new server-made id, ignoring one sent by the client', async () => {
    const { app } = testApp()
    const first = await app.request('/api/items/1', { headers: { 'X-Request-Id': 'injected' } })
    const second = await app.request('/api/items/1')
    const firstId = first.headers.get('X-Request-Id')
    expect(firstId).toMatch(REQUEST_ID)
    expect(second.headers.get('X-Request-Id')).toMatch(REQUEST_ID)
    expect(firstId).not.toBe(second.headers.get('X-Request-Id'))
  })

  it('sends the secure headers', async () => {
    const { app } = testApp()
    const response = await app.request('/api/items/1')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=')
  })

  it('logs a rejected request at info with the route pattern, never the path or query', async () => {
    const { app, entries } = testApp()
    const response = await app.request('/api/errors/forbidden?token=secret-in-query')
    const [rejected] = entries().filter((entry) => entry.event === 'http.request.rejected')
    expect(rejected).toMatchObject({
      level: 30,
      method: 'GET',
      route: '/api/errors/forbidden',
      status: 403,
      trace_id: response.headers.get('X-Request-Id'),
      channel: 'web',
    })
    expect(JSON.stringify(entries())).not.toContain('secret-in-query')
  })

  it('logs a successful request only at debug, with the route pattern', async () => {
    const { app, entries } = testApp('debug')
    await app.request('/api/items/0198-private-id')
    const [completed] = entries().filter((entry) => entry.event === 'http.request.completed')
    expect(completed).toMatchObject({ level: 20, route: '/api/items/:itemId', status: 200 })
    expect(JSON.stringify(entries())).not.toContain('0198-private-id')

    const quiet = testApp('info')
    await quiet.app.request('/api/items/1')
    expect(quiet.entries()).toEqual([])
  })
})
