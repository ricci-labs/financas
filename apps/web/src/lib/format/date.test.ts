import { formatDay } from '@web/lib/format/date'
import { describe, expect, it } from 'vitest'

describe('formatDay', () => {
  it('writes the calendar day of an instant in São Paulo', () => {
    expect(formatDay('2026-10-12T15:00:00.000Z')).toBe('12/10/2026')
  })

  it('takes the day of São Paulo, not of UTC, near midnight', () => {
    expect(formatDay('2026-10-13T01:30:00.000Z')).toBe('12/10/2026')
  })
})
