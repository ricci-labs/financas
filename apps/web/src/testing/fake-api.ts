import { vi } from 'vitest'

const SESSION_REQUIRED = 401

export function fakeApi(answers: Record<string, () => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = new URL(input instanceof Request ? input.url : String(input), location.href)
      .pathname
    const answer = answers[path]
    return Promise.resolve(answer ? answer() : Response.json({}, { status: 404 }))
  })
}

export function sessionRequired(): Response {
  return Response.json(
    { error: { code: 'SESSION_REQUIRED', message: 'Log in first', ref: 'abcd1234' } },
    { status: SESSION_REQUIRED },
  )
}

export function account(): Response {
  return Response.json({ id: 'user-a', email: 'member.a@exemplo.com', displayName: 'Member A' })
}
