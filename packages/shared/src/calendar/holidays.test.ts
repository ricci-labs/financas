import { nthBusinessDay } from '@shared/calendar/dates'
import { easterSunday, holidayDatesBetween, nationalHolidays } from '@shared/calendar/holidays'
import { describe, expect, it } from 'vitest'

describe('easterSunday', () => {
  it('matches the published dates, early and late in the season and in the corrected years', () => {
    expect(
      [1981, 2019, 2024, 2025, 2026, 2027, 2038, 2049, 2285].map((year) => easterSunday(year)),
    ).toEqual([
      '1981-04-19',
      '2019-04-21',
      '2024-03-31',
      '2025-04-20',
      '2026-04-05',
      '2027-03-28',
      '2038-04-25',
      '2049-04-18',
      '2285-03-22',
    ])
  })
})

describe('nationalHolidays', () => {
  it('lists the bank holidays of a year in date order, the movable ones from Easter', () => {
    expect(nationalHolidays(2026)).toEqual([
      { key: 'new_year', on: '2026-01-01' },
      { key: 'carnival_monday', on: '2026-02-16' },
      { key: 'carnival_tuesday', on: '2026-02-17' },
      { key: 'good_friday', on: '2026-04-03' },
      { key: 'tiradentes', on: '2026-04-21' },
      { key: 'labour_day', on: '2026-05-01' },
      { key: 'corpus_christi', on: '2026-06-04' },
      { key: 'independence_day', on: '2026-09-07' },
      { key: 'our_lady_aparecida', on: '2026-10-12' },
      { key: 'all_souls_day', on: '2026-11-02' },
      { key: 'republic_day', on: '2026-11-15' },
      { key: 'black_consciousness_day', on: '2026-11-20' },
      { key: 'christmas', on: '2026-12-25' },
    ])
  })

  it('has Black Consciousness Day only from 2024, when it became national', () => {
    const keysOf = (year: number) => nationalHolidays(year).map((holiday) => holiday.key)
    expect(keysOf(2023)).not.toContain('black_consciousness_day')
    expect(keysOf(2024)).toContain('black_consciousness_day')
  })
})

describe('holidayDatesBetween', () => {
  it('joins national and extra dates inside the range, across years', () => {
    const dates = holidayDatesBetween('2026-12-20', '2027-01-31', ['2027-01-25', '2027-03-01'])
    expect([...dates].sort()).toEqual(['2026-12-25', '2027-01-01', '2027-01-25'])
  })

  it('moves the fifth business day past a holiday week', () => {
    const november = holidayDatesBetween('2026-11-01', '2026-11-30')
    expect(nthBusinessDay({ year: 2026, month: 11 }, 5, november)).toBe('2026-11-09')
  })
})
