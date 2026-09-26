import { WEEKEND_RULES } from '@shared/calendar/calendar.constants'
import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import {
  MAX_RECURRENCE_BUSINESS_DAY,
  MAX_RECURRENCE_INTERVAL,
  RECURRENCE_FREQUENCIES,
} from '@shared/recurrence/recurrence.constants'
import { z } from 'zod'

const MAX_DAY_OF_MONTH = 31

export const recurrenceScheduleSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(MAX_RECURRENCE_INTERVAL).default(1),
    dayOfMonth: z.number().int().min(1).max(MAX_DAY_OF_MONTH).nullable().default(null),
    nthBusinessDay: z
      .number()
      .int()
      .min(1)
      .max(MAX_RECURRENCE_BUSINESS_DAY)
      .nullable()
      .default(null),
    weekendRule: z.enum(WEEKEND_RULES).default('keep'),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema.nullable().default(null),
  })
  .refine((schedule) => schedule.dayOfMonth === null || schedule.nthBusinessDay === null, {
    message: 'Choose a day of the month or a business day, not both',
    path: ['nthBusinessDay'],
  })
  .refine(
    (schedule) =>
      schedule.frequency !== 'weekly' ||
      (schedule.dayOfMonth === null && schedule.nthBusinessDay === null),
    { message: 'A weekly schedule repeats the weekday of startsOn', path: ['frequency'] },
  )
  .refine((schedule) => schedule.endsOn === null || schedule.endsOn >= schedule.startsOn, {
    message: 'endsOn must not be before startsOn',
    path: ['endsOn'],
  })

export type RecurrenceScheduleInput = z.input<typeof recurrenceScheduleSchema>
