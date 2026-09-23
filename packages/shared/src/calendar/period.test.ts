import { periodOf, periodStartingIn } from '@shared/calendar/period'
import { describe, expect, it } from 'vitest'

const october = { year: 2026, month: 10 }

describe('periodStartingIn', () => {
  it('calendar month', () => {
    expect(periodStartingIn(october, { anchor: 'calendar_month' })).toEqual({
      label: '2026-10',
      start: '2026-10-01',
      end: '2026-10-31',
    })
  })

  it('day of month 5', () => {
    expect(periodStartingIn(october, { anchor: 'day_of_month', day: 5 })).toEqual({
      label: '2026-10',
      start: '2026-10-05',
      end: '2026-11-04',
    })
  })

  it('day of month 31 clamps short months', () => {
    expect(periodStartingIn(october, { anchor: 'day_of_month', day: 31 })).toEqual({
      label: '2026-10',
      start: '2026-10-31',
      end: '2026-11-29',
    })
  })

  it('5th business day, with and without the Nov 2 holiday', () => {
    const settings = { anchor: 'nth_business_day', position: 5 } as const
    expect(periodStartingIn(october, settings, new Set(['2026-11-02']))).toEqual({
      label: '2026-10',
      start: '2026-10-07',
      end: '2026-11-08',
    })
    expect(periodStartingIn(october, settings).end).toBe('2026-11-05')
  })
})

describe('periodOf', () => {
  const settings = { anchor: 'day_of_month', day: 5 } as const

  it('a date on or after the anchor belongs to that month’s period', () => {
    expect(periodOf('2026-10-05', settings).label).toBe('2026-10')
    expect(periodOf('2026-10-20', settings).label).toBe('2026-10')
  })

  it('a date before the anchor belongs to the previous period', () => {
    expect(periodOf('2026-10-04', settings)).toEqual({
      label: '2026-09',
      start: '2026-09-05',
      end: '2026-10-04',
    })
  })

  it('crosses the year boundary', () => {
    expect(periodOf('2027-01-02', settings).label).toBe('2026-12')
  })
})
