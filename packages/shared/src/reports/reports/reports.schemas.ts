import { yearMonthSchema } from '@shared/planning/budgets/budgets.schemas'
import { z } from 'zod'

export const overviewQuerySchema = z.object({ period: yearMonthSchema.optional() })

export type OverviewQuery = z.infer<typeof overviewQuerySchema>
