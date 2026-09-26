import { pageLink } from '@api/core/email/links'
import { describe, expect, it } from 'vitest'

describe('pageLink', () => {
  it('builds a page address with the token in the fragment, never in the query', () => {
    expect(pageLink('https://financas.example.test', '/invite', 'abc-123')).toBe(
      'https://financas.example.test/invite#token=abc-123',
    )
  })

  it('builds a plain page address without a token', () => {
    expect(pageLink('https://financas.example.test/', '/login')).toBe(
      'https://financas.example.test/login',
    )
  })
})
