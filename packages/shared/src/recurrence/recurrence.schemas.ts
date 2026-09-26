import { WEEKEND_RULES } from '@shared/calendar/calendar.constants'
import { daysBetween } from '@shared/calendar/dates'
import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import {
  MAX_OCCURRENCE_LIST_DAYS,
  MAX_RECURRENCE_BUSINESS_DAY,
  MAX_RECURRENCE_INTERVAL,
  MAX_REMIND_DAYS_BEFORE,
  RECURRENCE_DESCRIPTION_MAX_LENGTH,
  RECURRENCE_FREQUENCIES,
  RECURRING_ENTRY_TYPES,
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

const recurrenceRuleFields = {
  description: z.string().trim().min(1).max(RECURRENCE_DESCRIPTION_MAX_LENGTH),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  amountIsEstimate: z.boolean(),
  sourceAccountId: z.uuid(),
  categoryAccountId: z.uuid(),
  schedule: recurrenceScheduleSchema,
  remindDaysBefore: z.number().int().min(0).max(MAX_REMIND_DAYS_BEFORE).nullable(),
  autoRecord: z.boolean(),
}

export const newRecurrenceRuleSchema = z.strictObject({
  ...recurrenceRuleFields,
  entryType: z.enum(RECURRING_ENTRY_TYPES),
  amountIsEstimate: recurrenceRuleFields.amountIsEstimate.default(false),
  remindDaysBefore: recurrenceRuleFields.remindDaysBefore.default(null),
  autoRecord: recurrenceRuleFields.autoRecord.default(false),
})

export type NewRecurrenceRule = z.infer<typeof newRecurrenceRuleSchema>

export const recurrenceRuleChangeSchema = z
  .strictObject(recurrenceRuleFields)
  .partial()
  .refine((change) => Object.keys(change).length > 0, { message: 'Nothing to change' })

export type RecurrenceRuleChange = z.infer<typeof recurrenceRuleChangeSchema>

export const recurrenceRuleParamsSchema = z.object({ ruleId: z.uuid() })

export const occurrenceListQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((range) => range.from <= range.to, {
    message: 'from must not be after to',
    path: ['from'],
  })
  .refine((range) => daysBetween(range.from, range.to) < MAX_OCCURRENCE_LIST_DAYS, {
    message: 'The range is too long',
    path: ['to'],
  })

export type OccurrenceListQuery = z.infer<typeof occurrenceListQuerySchema>

export const occurrenceParamsSchema = z.object({ occurrenceId: z.uuid() })

export const occurrenceSuggestionQuerySchema = z.object({ entryId: z.uuid() })

export const occurrenceMatchSchema = z.strictObject({ entryId: z.uuid() })

export const occurrenceChangeSchema = z.strictObject({
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})

export type OccurrenceChange = z.infer<typeof occurrenceChangeSchema>
