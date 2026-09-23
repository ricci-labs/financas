import type { IsoDate, Period, PeriodSettings, YearMonth } from '@shared/calendar/calendar.types'
import {
  addDays,
  addMonths,
  clampedDate,
  nthBusinessDay,
  parseIsoDate,
  toYearMonthLabel,
} from '@shared/calendar/dates'

const NO_HOLIDAYS: ReadonlySet<IsoDate> = new Set()

export function periodOf(
  date: IsoDate,
  settings: PeriodSettings,
  holidays: ReadonlySet<IsoDate> = NO_HOLIDAYS,
): Period {
  const { year, month } = parseIsoDate(date)
  const dateMonth = { year, month }
  const startsBeforeDate = date >= periodStart(dateMonth, settings, holidays)
  const startMonth = startsBeforeDate ? dateMonth : addMonths(dateMonth, -1)
  return periodStartingIn(startMonth, settings, holidays)
}

export function periodStartingIn(
  yearMonth: YearMonth,
  settings: PeriodSettings,
  holidays: ReadonlySet<IsoDate> = NO_HOLIDAYS,
): Period {
  const start = periodStart(yearMonth, settings, holidays)
  const nextStart = periodStart(addMonths(yearMonth, 1), settings, holidays)
  return {
    label: toYearMonthLabel(yearMonth),
    start,
    end: addDays(nextStart, -1),
  }
}

function periodStart(
  yearMonth: YearMonth,
  settings: PeriodSettings,
  holidays: ReadonlySet<IsoDate>,
): IsoDate {
  switch (settings.anchor) {
    case 'calendar_month':
      return clampedDate(yearMonth, 1)
    case 'day_of_month':
      assertDayOfMonth(settings.day)
      return clampedDate(yearMonth, settings.day)
    case 'nth_business_day':
      return nthBusinessDay(yearMonth, settings.position, holidays)
  }
}

function assertDayOfMonth(day: number): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`Period day must be between 1 and 31: ${day}`)
  }
}
