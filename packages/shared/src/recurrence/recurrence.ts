import type { IsoDate } from '@shared/calendar/calendar.types'
import {
  addDays,
  addMonths,
  clampedDate,
  daysBetween,
  nthBusinessDay,
  parseIsoDate,
  shiftToBusinessDay,
} from '@shared/calendar/dates'
import {
  APPROXIMATE_DAYS_PER_STEP,
  DAYS_A_DUE_DATE_MAY_SHIFT,
} from '@shared/recurrence/recurrence.constants'
import type { DateRange, RecurrenceSchedule } from '@shared/recurrence/recurrence.types'

const DAYS_PER_WEEK = 7
const MONTHS_PER_YEAR = 12

export function dueDatesBetween(
  schedule: RecurrenceSchedule,
  { from, to }: DateRange,
  holidays: ReadonlySet<IsoDate>,
): IsoDate[] {
  const lastNominal = lastNominalDate(schedule, to)
  const dueDates: IsoDate[] = []
  for (let step = 0; ; step += 1) {
    const nominal = nominalDate(schedule, step, holidays)
    if (nominal > lastNominal) {
      return dueDates
    }
    const due = shiftToBusinessDay(nominal, schedule.weekendRule, holidays)
    if (nominal >= schedule.startsOn && due >= from && due <= to) {
      dueDates.push(due)
    }
  }
}

export function withoutDatesNearKept(
  dueDates: readonly IsoDate[],
  keptDates: readonly IsoDate[],
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval'>,
): IsoDate[] {
  const halfStep = (APPROXIMATE_DAYS_PER_STEP[schedule.frequency] * schedule.interval) / 2
  const isNearAKeptDate = (due: IsoDate) =>
    keptDates.some((kept) => Math.abs(daysBetween(kept, due)) < halfStep)
  return dueDates.filter((due) => !isNearAKeptDate(due))
}

function lastNominalDate(schedule: RecurrenceSchedule, to: IsoDate): IsoDate {
  const beyondRange = addDays(to, DAYS_A_DUE_DATE_MAY_SHIFT)
  return schedule.endsOn && schedule.endsOn < beyondRange ? schedule.endsOn : beyondRange
}

function nominalDate(
  schedule: RecurrenceSchedule,
  step: number,
  holidays: ReadonlySet<IsoDate>,
): IsoDate {
  const start = parseIsoDate(schedule.startsOn)
  if (schedule.frequency === 'weekly') {
    return addDays(schedule.startsOn, step * schedule.interval * DAYS_PER_WEEK)
  }
  const monthsPerStep = schedule.frequency === 'yearly' ? MONTHS_PER_YEAR : 1
  const month = addMonths(start, step * schedule.interval * monthsPerStep)
  if (schedule.nthBusinessDay !== null) {
    return nthBusinessDay(month, schedule.nthBusinessDay, holidays)
  }
  return clampedDate(month, schedule.dayOfMonth ?? start.day)
}
