import { outsideQuietHours } from '@shared/identity/notifications/quiet-hours'
import { describe, expect, it } from 'vitest'

const SAO_PAULO = 'America/Sao_Paulo'
const NIGHT = { start: '22:00', end: '07:00' }

function at(iso: string) {
  return new Date(iso)
}

describe('outsideQuietHours', () => {
  it('moves a message due at night to the end of the quiet hours, the next morning', () => {
    expect(outsideQuietHours(at('2026-10-15T02:00:00Z'), SAO_PAULO, NIGHT).toISOString()).toBe(
      '2026-10-15T10:00:00.000Z',
    )
    expect(outsideQuietHours(at('2026-10-15T01:30:00Z'), SAO_PAULO, NIGHT).toISOString()).toBe(
      '2026-10-15T10:00:00.000Z',
    )
  })

  it('moves a message due before dawn to the same morning', () => {
    expect(outsideQuietHours(at('2026-10-15T09:00:00Z'), SAO_PAULO, NIGHT).toISOString()).toBe(
      '2026-10-15T10:00:00.000Z',
    )
  })

  it('keeps a message outside the quiet hours, at their end, or without them', () => {
    const noon = at('2026-10-15T15:00:00Z')
    expect(outsideQuietHours(noon, SAO_PAULO, NIGHT)).toBe(noon)
    const wakeUp = at('2026-10-15T10:00:00Z')
    expect(outsideQuietHours(wakeUp, SAO_PAULO, NIGHT)).toBe(wakeUp)
    expect(outsideQuietHours(noon, SAO_PAULO, null)).toBe(noon)
    expect(outsideQuietHours(noon, SAO_PAULO, { start: '09:00', end: '09:00' })).toBe(noon)
  })

  it('handles a window within one day and zones with half-hour offsets', () => {
    const lunch = { start: '12:00', end: '14:00' }
    expect(outsideQuietHours(at('2026-10-15T15:30:00Z'), SAO_PAULO, lunch).toISOString()).toBe(
      '2026-10-15T17:00:00.000Z',
    )
    expect(outsideQuietHours(at('2026-10-15T17:00:00Z'), 'Asia/Kolkata', NIGHT).toISOString()).toBe(
      '2026-10-16T01:30:00.000Z',
    )
  })
})
