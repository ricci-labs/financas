import {
  FIRST_YEAR_OF_BLACK_CONSCIOUSNESS_HOLIDAY,
  type NationalHolidayKey,
} from '@shared/calendar/calendar.constants'
import type { IsoDate, NationalHoliday } from '@shared/calendar/calendar.types'
import { addDays, toIsoDate } from '@shared/calendar/dates'

const DAYS_FROM_EASTER: ReadonlyArray<[NationalHolidayKey, number]> = [
  ['carnival_monday', -48],
  ['carnival_tuesday', -47],
  ['good_friday', -2],
  ['corpus_christi', 60],
]

const FIXED_DATES: ReadonlyArray<[NationalHolidayKey, number, number]> = [
  ['new_year', 1, 1],
  ['tiradentes', 4, 21],
  ['labour_day', 5, 1],
  ['independence_day', 9, 7],
  ['our_lady_aparecida', 10, 12],
  ['all_souls_day', 11, 2],
  ['republic_day', 11, 15],
  ['black_consciousness_day', 11, 20],
  ['christmas', 12, 25],
]

export function nationalHolidays(year: number): NationalHoliday[] {
  const easter = easterSunday(year)
  const movable = DAYS_FROM_EASTER.map(([key, days]) => ({ key, on: addDays(easter, days) }))
  const fixed = FIXED_DATES.filter(([key]) => isHolidayIn(key, year)).map(([key, month, day]) => ({
    key,
    on: toIsoDate(year, month, day),
  }))
  return [...movable, ...fixed].sort((left, right) => left.on.localeCompare(right.on))
}

export function holidayDatesBetween(
  start: IsoDate,
  end: IsoDate,
  extraDates: readonly IsoDate[] = [],
): ReadonlySet<IsoDate> {
  const firstYear = Number(start.slice(0, 4))
  const lastYear = Number(end.slice(0, 4))
  const national = Array.from({ length: lastYear - firstYear + 1 }, (_, index) =>
    nationalHolidays(firstYear + index).map((holiday) => holiday.on),
  ).flat()
  return new Set([...national, ...extraDates].filter((date) => date >= start && date <= end))
}

export function easterSunday(year: number): IsoDate {
  const goldenNumber = year % 19
  const century = Math.floor(year / 100)
  const yearOfCentury = year % 100
  const leapCenturies = Math.floor(century / 4)
  const centuryRemainder = century % 4
  const moonCorrection = Math.floor((century + 8) / 25)
  const solarCorrection = Math.floor((century - moonCorrection + 1) / 3)
  const epact = (19 * goldenNumber + century - leapCenturies - solarCorrection + 15) % 30
  const weekdayOffset =
    (32 + 2 * centuryRemainder + 2 * Math.floor(yearOfCentury / 4) - epact - (yearOfCentury % 4)) %
    7
  const lateCorrection = Math.floor((goldenNumber + 11 * epact + 22 * weekdayOffset) / 451)
  const monthAndDay = epact + weekdayOffset - 7 * lateCorrection + 114
  return toIsoDate(year, Math.floor(monthAndDay / 31), (monthAndDay % 31) + 1)
}

function isHolidayIn(key: NationalHolidayKey, year: number): boolean {
  return key !== 'black_consciousness_day' || year >= FIRST_YEAR_OF_BLACK_CONSCIOUSNESS_HOLIDAY
}
