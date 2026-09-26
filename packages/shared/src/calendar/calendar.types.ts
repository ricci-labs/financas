import type { NationalHolidayKey } from '@shared/calendar/calendar.constants'

export type IsoDate = string

export type YearMonth = {
  year: number
  month: number
}

export type PeriodSettings =
  | { anchor: 'calendar_month' }
  | { anchor: 'day_of_month'; day: number }
  | { anchor: 'nth_business_day'; position: number }

export type Period = {
  label: string
  start: IsoDate
  end: IsoDate
}

export type DateParts = YearMonth & {
  day: number
}

export type NationalHoliday = {
  on: IsoDate
  key: NationalHolidayKey
}
