import { appPathOrHome } from '@web/lib/navigation'
import { describe, expect, it } from 'vitest'

describe('appPathOrHome', () => {
  it('keeps a path of the app, with its search and hash', () => {
    expect(appPathOrHome('/w/abc/entries?month=2026-10#top')).toBe(
      '/w/abc/entries?month=2026-10#top',
    )
  })

  it.each([
    ['missing', undefined],
    ['another site', 'https://evil.test/'],
    ['a protocol-relative address', '//evil.test/'],
    ['a backslash trick', '/\\evil.test'],
    ['a relative path', 'entries'],
  ])('falls back to the home page for %s', (_, path) => {
    expect(appPathOrHome(path)).toBe('/')
  })
})
