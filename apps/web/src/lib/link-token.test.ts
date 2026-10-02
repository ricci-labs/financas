import { tokenFromFragment } from '@web/lib/link-token'
import { describe, expect, it } from 'vitest'

describe('tokenFromFragment', () => {
  it('reads the token of a link fragment, with or without its mark', () => {
    expect(tokenFromFragment('#token=abc123')).toBe('abc123')
    expect(tokenFromFragment('token=abc123')).toBe('abc123')
    expect(tokenFromFragment('#other=1&token=abc123')).toBe('abc123')
  })

  it('finds nothing when the fragment has no token', () => {
    expect(tokenFromFragment('')).toBeNull()
    expect(tokenFromFragment('#')).toBeNull()
    expect(tokenFromFragment('#token=')).toBeNull()
    expect(tokenFromFragment('#section')).toBeNull()
  })
})
