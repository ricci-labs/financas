import { z } from 'zod'

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const yearMonthSchema = z.string().regex(YEAR_MONTH_PATTERN, 'Expected YYYY-MM')

export const budgetChangeSchema = z.strictObject({
  limitCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  fromPeriod: yearMonthSchema,
})

export type BudgetChange = z.infer<typeof budgetChangeSchema>

export const budgetListQuerySchema = z.object({ period: yearMonthSchema })

export const budgetParamsSchema = z.object({ categoryId: z.uuid() })
