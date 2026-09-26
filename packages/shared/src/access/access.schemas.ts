import { deletionRequestSchema } from '@shared/deletion/deletion.schemas'
import { z } from 'zod'

export const memberParamsSchema = z.object({ membershipId: z.uuid() })

export const memberRoleChangeSchema = z.object({ roleId: z.uuid() })

export const memberRemovalSchema = deletionRequestSchema

export type MemberParams = z.infer<typeof memberParamsSchema>
export type MemberRoleChange = z.infer<typeof memberRoleChangeSchema>
