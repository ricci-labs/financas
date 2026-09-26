import {
  addDays,
  addMonths,
  clampedDate,
  dayOfWeek,
  daysBetween,
  daysInMonth,
  isBusinessDay,
  nthBusinessDay,
  parseIsoDate,
  shiftToBusinessDay,
  todayIn,
} from '@shared/calendar/dates'
import { describe, expect, it } from 'vitest'

const NO_HOLIDAYS = new Set<string>()

describe('parseIsoDate', () => {
  it('splits a valid date', () => {
    expect(parseIsoDate('2026-10-07')).toEqual({ year: 2026, month: 10, day: 7 })
  })

  it.each(['2026-13-01', '2026-02-30', '2026-1-1', 'yesterday'])('rejects %j', (input) => {
    expect(() => parseIsoDate(input)).toThrow(RangeError)
  })
})

describe('daysInMonth', () => {
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 9, 30],
    [2026, 12, 31],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(daysInMonth({ year, month })).toBe(days)
  })
})

describe('addMonths', () => {
  it('crosses year boundaries in both directions', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('clampedDate', () => {
  it('uses the last day when the month is shorter', () => {
    expect(clampedDate({ year: 2026, month: 9 }, 31)).toBe('2026-09-30')
    expect(clampedDate({ year: 2027, month: 2 }, 31)).toBe('2027-02-28')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-11-05', -5)).toBe('2026-10-31')
  })
})

describe('business days', () => {
  it('knows the weekday', () => {
    expect(dayOfWeek('2026-10-01')).toBe(4)
    expect(dayOfWeek('2026-11-01')).toBe(0)
  })

  it('excludes weekends and holidays', () => {
    expect(isBusinessDay('2026-10-03', NO_HOLIDAYS)).toBe(false)
    expect(isBusinessDay('2026-11-02', new Set(['2026-11-02']))).toBe(false)
    expect(isBusinessDay('2026-11-03', NO_HOLIDAYS)).toBe(true)
  })

  it('finds the n-th business day of a month', () => {
    expect(nthBusinessDay({ year: 2026, month: 10 }, 5, NO_HOLIDAYS)).toBe('2026-10-07')
    expect(nthBusinessDay({ year: 2026, month: 11 }, 1, new Set(['2026-11-02']))).toBe('2026-11-03')
  })

  it('rejects impossible positions', () => {
    expect(() => nthBusinessDay({ year: 2026, month: 10 }, 0, NO_HOLIDAYS)).toThrow(RangeError)
    expect(() => nthBusinessDay({ year: 2026, month: 10 }, 30, NO_HOLIDAYS)).toThrow(RangeError)
  })
})

describe('todayIn', () => {
  it('takes the calendar day of the time zone, not of UTC', () => {
    const lateNightInSaoPaulo = new Date('2026-09-25T02:30:00Z')
    expect(todayIn('America/Sao_Paulo', lateNightInSaoPaulo)).toBe('2026-09-24')
    expect(todayIn('UTC', lateNightInSaoPaulo)).toBe('2026-09-25')
  })
})

describe('shiftToBusinessDay', () => {
  const holidays = new Set(['2026-10-12'])

  it('keeps a business day whatever the rule', () => {
    expect(shiftToBusinessDay('2026-10-13', 'next_business_day', holidays)).toBe('2026-10-13')
  })

  it('moves a date on a weekend or holiday back or forth, or keeps it', () => {
    expect(shiftToBusinessDay('2026-10-10', 'next_business_day', holidays)).toBe('2026-10-13')
    expect(shiftToBusinessDay('2026-10-12', 'previous_business_day', holidays)).toBe('2026-10-09')
    expect(shiftToBusinessDay('2026-10-11', 'keep', holidays)).toBe('2026-10-11')
  })
})

describe('daysBetween', () => {
  it('counts calendar days across months, years and backwards', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-03-01', '2026-02-27')).toBe(-2)
  })
})
