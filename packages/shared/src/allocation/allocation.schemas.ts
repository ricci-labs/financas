import {
  MAX_ALLOCATION_PERCENT,
  MAX_ALLOCATION_STEPS,
} from '@shared/allocation/allocation.constants'
import { z } from 'zod'

const centsSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

export const allocationStepSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fill_goal'), goalId: z.uuid() }),
  z.strictObject({ kind: z.literal('cover_overspent') }),
  z.strictObject({
    kind: z.literal('percent'),
    accountId: z.uuid(),
    percent: z.number().int().min(1).max(MAX_ALLOCATION_PERCENT),
  }),
  z.strictObject({
    kind: z.literal('fixed_amount'),
    accountId: z.uuid(),
    amountCents: centsSchema,
  }),
  z.strictObject({ kind: z.literal('rest'), accountId: z.uuid() }),
])

export type AllocationStepInput = z.infer<typeof allocationStepSchema>

export const allocationStepsSchema = z
  .strictObject({ steps: z.array(allocationStepSchema).max(MAX_ALLOCATION_STEPS) })
  .refine(
    ({ steps }) => steps.every((step, index) => step.kind !== 'rest' || index === steps.length - 1),
    { message: 'Only the last step can take the rest', path: ['steps'] },
  )

export const allocationSuggestionQuerySchema = z.object({
  amountCents: z.coerce.number().pipe(centsSchema),
})
