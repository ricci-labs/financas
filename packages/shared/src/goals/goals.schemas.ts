import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import { z } from 'zod'

export const GOAL_NAME_MAX_LENGTH = 80

const goalFields = {
  name: z.string().trim().min(1).max(GOAL_NAME_MAX_LENGTH),
  targetCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  targetOn: isoDateSchema.nullable(),
  accountId: z.uuid(),
  isReserve: z.boolean(),
}

export const newGoalSchema = z.strictObject({
  ...goalFields,
  targetOn: goalFields.targetOn.default(null),
  isReserve: goalFields.isReserve.default(false),
})

export type NewGoal = z.infer<typeof newGoalSchema>

export const goalChangeSchema = z
  .strictObject(goalFields)
  .partial()
  .refine((change) => Object.keys(change).length > 0, { message: 'Nothing to change' })

export type GoalChange = z.infer<typeof goalChangeSchema>

export const goalParamsSchema = z.object({ goalId: z.uuid() })
