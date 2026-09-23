import {
  addDays,
  addMonths,
  clampedDate,
  type IsoDate,
  nthBusinessDay,
  parseIsoDate,
  toYearMonthLabel,
  type YearMonth,
} from '@shared/domain/dates'

export type PeriodSettings =
  | { anchor: 'calendar_month' }
  | { anchor: 'day_of_month'; day: number }
  | { anchor: 'nth_business_day'; position: number }

export type Period = {
  label: string
  start: IsoDate
  end: IsoDate
}

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
