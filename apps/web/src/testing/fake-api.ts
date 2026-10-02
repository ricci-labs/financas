import type { FakeAnswer } from '@web/testing/testing.types'
import { vi } from 'vitest'

const SESSION_REQUIRED = 401
const NOT_FOUND = 404

export function fakeApi(answers: Record<string, FakeAnswer>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const request = new Request(
      input instanceof Request ? input : new URL(String(input), location.href),
      init,
    )
    const { pathname } = new URL(request.url)
    const method = request.method.toUpperCase()
    const answer = answers[`${method} ${pathname}`] ?? answers[pathname]
    return Promise.resolve(answer ? answer(request) : Response.json({}, { status: NOT_FOUND }))
  })
}

export function apiError(
  code: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json({ error: { code, message: code, ref: 'abcd1234' } }, { status, headers })
}

export function sessionRequired(): Response {
  return apiError('SESSION_REQUIRED', SESSION_REQUIRED)
}

export function account(): Response {
  return Response.json({ id: 'user-a', email: 'member.a@exemplo.com', displayName: 'Member A' })
}
