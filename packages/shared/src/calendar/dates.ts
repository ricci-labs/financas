import type { WeekendRule } from '@shared/calendar/calendar.constants'
import type { DateParts, IsoDate, YearMonth } from '@shared/calendar/calendar.types'

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const SUNDAY = 0
const SATURDAY = 6
const MS_PER_DAY = 24 * 60 * 60 * 1000
const STEP_OF_WEEKEND_RULE: Record<WeekendRule, number> = {
  keep: 0,
  previous_business_day: -1,
  next_business_day: 1,
}

export function parseIsoDate(date: IsoDate): DateParts {
  const match = ISO_DATE_PATTERN.exec(date)
  if (!match) {
    throw new RangeError(`Invalid ISO date: ${date}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const isValidMonth = month >= 1 && month <= 12
  const isValidDay = isValidMonth && day >= 1 && day <= daysInMonth({ year, month })
  if (!isValidDay) {
    throw new RangeError(`Invalid ISO date: ${date}`)
  }

  return { year, month, day }
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${padYear(year)}-${padTwoDigits(month)}-${padTwoDigits(day)}`
}

export function toYearMonthLabel({ year, month }: YearMonth): string {
  return `${padYear(year)}-${padTwoDigits(month)}`
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addMonths({ year, month }: YearMonth, count: number): YearMonth {
  const monthIndex = year * 12 + (month - 1) + count
  return {
    year: Math.floor(monthIndex / 12),
    month: (monthIndex % 12) + 1,
  }
}

export function clampedDate(yearMonth: YearMonth, day: number): IsoDate {
  const lastDay = daysInMonth(yearMonth)
  return toIsoDate(yearMonth.year, yearMonth.month, Math.min(day, lastDay))
}

export function addDays(date: IsoDate, count: number): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + count))
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcTime(to) - utcTime(from)) / MS_PER_DAY)
}

export function dayOfWeek(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function isBusinessDay(date: IsoDate, holidays: ReadonlySet<IsoDate>): boolean {
  const weekday = dayOfWeek(date)
  const isWeekend = weekday === SUNDAY || weekday === SATURDAY
  return !isWeekend && !holidays.has(date)
}

export function shiftToBusinessDay(
  date: IsoDate,
  rule: WeekendRule,
  holidays: ReadonlySet<IsoDate>,
): IsoDate {
  const step = STEP_OF_WEEKEND_RULE[rule]
  let shifted = date
  while (step !== 0 && !isBusinessDay(shifted, holidays)) {
    shifted = addDays(shifted, step)
  }
  return shifted
}

export function nthBusinessDay(
  yearMonth: YearMonth,
  position: number,
  holidays: ReadonlySet<IsoDate>,
): IsoDate {
  if (!Number.isInteger(position) || position < 1) {
    throw new RangeError(`Business day position must be a positive integer: ${position}`)
  }

  const businessDays = datesOfMonth(yearMonth).filter((date) => isBusinessDay(date, holidays))
  const found = businessDays[position - 1]
  if (!found) {
    const label = toYearMonthLabel(yearMonth)
    throw new RangeError(`${label} has fewer than ${position} business days`)
  }

  return found
}

function datesOfMonth(yearMonth: YearMonth): IsoDate[] {
  return Array.from({ length: daysInMonth(yearMonth) }, (_, index) =>
    toIsoDate(yearMonth.year, yearMonth.month, index + 1),
  )
}

function padYear(year: number): string {
  return String(year).padStart(4, '0')
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayIn(timeZone: string, instant: Date): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  return toIsoDate(part('year'), part('month'), part('day'))
}

function utcTime(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  return Date.UTC(year, month - 1, day)
}
