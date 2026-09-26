import { z } from 'zod'

export const DELETE_REASON_MAX_LENGTH = 200

export const deletionRequestSchema = z.object({
  reason: z.string().trim().min(1).max(DELETE_REASON_MAX_LENGTH).optional(),
})

export type DeletionRequest = z.infer<typeof deletionRequestSchema>
