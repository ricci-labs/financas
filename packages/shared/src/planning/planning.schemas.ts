import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import { z } from 'zod'

export const HOLIDAY_NAME_MAX_LENGTH = 80

export const HOLIDAY_YEAR_MIN = 2000

export const HOLIDAY_YEAR_MAX = 2100

export const newHolidaySchema = z.strictObject({
  onDate: isoDateSchema,
  name: z.string().trim().min(1).max(HOLIDAY_NAME_MAX_LENGTH),
})

export type NewHoliday = z.infer<typeof newHolidaySchema>

export const holidayListQuerySchema = z.object({
  year: z.coerce.number().int().min(HOLIDAY_YEAR_MIN).max(HOLIDAY_YEAR_MAX),
})

export type HolidayListQuery = z.infer<typeof holidayListQuerySchema>

export const holidayParamsSchema = z.object({ holidayId: z.uuid() })
