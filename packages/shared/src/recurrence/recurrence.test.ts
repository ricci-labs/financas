import { holidayDatesBetween } from '@shared/calendar/holidays'
import { dueDatesBetween, withoutDatesNearKept } from '@shared/recurrence/recurrence'
import {
  occurrenceListQuerySchema,
  recurrenceScheduleSchema,
} from '@shared/recurrence/recurrence.schemas'
import type { RecurrenceSchedule } from '@shared/recurrence/recurrence.types'
import { describe, expect, it } from 'vitest'

const HOLIDAYS = holidayDatesBetween('2024-01-01', '2028-12-31')

function schedule(overrides: Partial<RecurrenceSchedule>): RecurrenceSchedule {
  return {
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: null,
    nthBusinessDay: null,
    weekendRule: 'keep',
    startsOn: '2026-01-01',
    endsOn: null,
    ...overrides,
  }
}

describe('dueDatesBetween', () => {
  it('pays a salary on the fifth business day, past holidays', () => {
    const salary = schedule({ nthBusinessDay: 5 })
    expect(dueDatesBetween(salary, { from: '2026-10-01', to: '2026-12-31' }, HOLIDAYS)).toEqual([
      '2026-10-07',
      '2026-11-09',
      '2026-12-07',
    ])
  })

  it('moves rent due on a weekend or holiday to the next business day', () => {
    const rent = schedule({ dayOfMonth: 10, weekendRule: 'next_business_day' })
    expect(dueDatesBetween(rent, { from: '2026-10-01', to: '2027-01-31' }, HOLIDAYS)).toEqual([
      '2026-10-13',
      '2026-11-10',
      '2026-12-10',
      '2027-01-11',
    ])
  })

  it('takes the last day of shorter months for day 31', () => {
    const endOfMonth = schedule({ dayOfMonth: 31 })
    expect(dueDatesBetween(endOfMonth, { from: '2026-02-01', to: '2026-04-30' }, HOLIDAYS)).toEqual(
      ['2026-02-28', '2026-03-31', '2026-04-30'],
    )
  })

  it('pulls a due date from past the range end into it when paying on the business day before', () => {
    const endOfMonth = schedule({ dayOfMonth: 31, weekendRule: 'previous_business_day' })
    expect(dueDatesBetween(endOfMonth, { from: '2026-10-01', to: '2026-10-30' }, HOLIDAYS)).toEqual(
      ['2026-10-30'],
    )
  })

  it('repeats every N months from the start day', () => {
    const quarterly = schedule({ interval: 3, startsOn: '2026-01-15' })
    expect(dueDatesBetween(quarterly, { from: '2026-01-01', to: '2026-12-31' }, HOLIDAYS)).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ])
  })

  it('repeats yearly, on February 28 when the 29th is missing', () => {
    const yearly = schedule({ frequency: 'yearly', startsOn: '2024-02-29' })
    expect(dueDatesBetween(yearly, { from: '2025-01-01', to: '2028-12-31' }, HOLIDAYS)).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })

  it('repeats every two weeks until it ends', () => {
    const biweekly = schedule({
      frequency: 'weekly',
      interval: 2,
      startsOn: '2026-10-05',
      endsOn: '2026-11-01',
    })
    expect(dueDatesBetween(biweekly, { from: '2026-10-01', to: '2026-11-30' }, HOLIDAYS)).toEqual([
      '2026-10-05',
      '2026-10-19',
    ])
  })

  it('never starts before startsOn, and is empty before it', () => {
    const lateStart = schedule({ dayOfMonth: 5, startsOn: '2026-10-20' })
    expect(dueDatesBetween(lateStart, { from: '2026-10-01', to: '2026-12-31' }, HOLIDAYS)).toEqual([
      '2026-11-05',
      '2026-12-05',
    ])
    expect(dueDatesBetween(lateStart, { from: '2026-01-01', to: '2026-10-31' }, HOLIDAYS)).toEqual(
      [],
    )
  })
})

describe('recurrenceScheduleSchema', () => {
  it('fills the defaults of a monthly schedule', () => {
    expect(
      recurrenceScheduleSchema.parse({ frequency: 'monthly', startsOn: '2026-10-01' }),
    ).toEqual({
      frequency: 'monthly',
      interval: 1,
      dayOfMonth: null,
      nthBusinessDay: null,
      weekendRule: 'keep',
      startsOn: '2026-10-01',
      endsOn: null,
    })
  })

  it('refuses a day and a business day together, a weekly day and an end before the start', () => {
    const invalid = [
      { frequency: 'monthly', startsOn: '2026-10-01', dayOfMonth: 5, nthBusinessDay: 5 },
      { frequency: 'weekly', startsOn: '2026-10-01', dayOfMonth: 5 },
      { frequency: 'monthly', startsOn: '2026-10-01', endsOn: '2026-09-30' },
      { frequency: 'monthly', startsOn: '2026-10-01', nthBusinessDay: 11 },
    ]
    for (const input of invalid) {
      expect(recurrenceScheduleSchema.safeParse(input).success).toBe(false)
    }
  })
})

describe('withoutDatesNearKept', () => {
  it('drops a new due date in the same step as a paid or skipped one, keeps the others', () => {
    const monthly = { frequency: 'monthly' as const, interval: 1 }
    expect(
      withoutDatesNearKept(['2026-10-15', '2026-11-15', '2026-12-15'], ['2026-10-10'], monthly),
    ).toEqual(['2026-11-15', '2026-12-15'])
    expect(withoutDatesNearKept(['2026-11-09'], ['2026-10-10'], monthly)).toEqual(['2026-11-09'])
  })

  it('scales the window with the frequency and the interval', () => {
    const weekly = { frequency: 'weekly' as const, interval: 1 }
    expect(withoutDatesNearKept(['2026-10-08', '2026-10-12'], ['2026-10-05'], weekly)).toEqual([
      '2026-10-12',
    ])
    const quarterly = { frequency: 'monthly' as const, interval: 3 }
    expect(withoutDatesNearKept(['2026-11-10', '2026-12-20'], ['2026-10-01'], quarterly)).toEqual([
      '2026-12-20',
    ])
  })
})

describe('occurrenceListQuerySchema', () => {
  it('takes a range of up to a year, in order', () => {
    expect(
      occurrenceListQuerySchema.safeParse({ from: '2026-10-01', to: '2027-09-30' }).success,
    ).toBe(true)
    expect(
      occurrenceListQuerySchema.safeParse({ from: '2026-10-01', to: '2027-10-02' }).success,
    ).toBe(false)
    expect(
      occurrenceListQuerySchema.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success,
    ).toBe(false)
  })
})
