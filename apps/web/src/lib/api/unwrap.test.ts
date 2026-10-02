import { ApiError, NetworkError } from '@web/lib/api/api-error'
import { unwrap, unwrapEmpty } from '@web/lib/api/unwrap'
import { describe, expect, it } from 'vitest'

const TOO_MANY_REQUESTS = 429
const SERVER_ERROR = 500

function answer(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Promise.resolve(Response.json(body, { status, headers }))
}

async function errorOf(request: Promise<unknown>): Promise<unknown> {
  try {
    await request
  } catch (error) {
    return error
  }
  throw new Error('expected the request to fail')
}

describe('unwrap', () => {
  it('returns the body of a successful answer', async () => {
    await expect(unwrap(answer(200, { version: 'dev' }))).resolves.toEqual({ version: 'dev' })
  })

  it('turns the error body into an ApiError with the code, ref and wait', async () => {
    const error = await errorOf(
      unwrap(
        answer(
          TOO_MANY_REQUESTS,
          { error: { code: 'TOO_MANY_ATTEMPTS', message: 'x' } },
          {
            'Retry-After': '900',
          },
        ),
      ),
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429, code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 900 })
  })

  it('keeps the ref of a server error', async () => {
    const body = { error: { code: 'INTERNAL_ERROR', message: 'x', ref: '4f3a9c1b' } }
    const error = await errorOf(unwrap(answer(SERVER_ERROR, body)))
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', ref: '4f3a9c1b', isServerError: true })
  })

  it('calls an answer without the error shape UNKNOWN', async () => {
    const error = await errorOf(unwrap(answer(SERVER_ERROR, { unexpected: true })))
    expect(error).toMatchObject({ code: 'UNKNOWN', ref: null, retryAfterSeconds: null })
  })

  it('turns a failed request into a NetworkError', async () => {
    const error = await errorOf(unwrap(Promise.reject(new TypeError('Failed to fetch'))))
    expect(error).toBeInstanceOf(NetworkError)
  })
})

describe('unwrapEmpty', () => {
  it('accepts an answer with no body', async () => {
    await expect(unwrapEmpty(Promise.resolve(new Response(null, { status: 204 })))).resolves.toBe(
      undefined,
    )
  })
})
