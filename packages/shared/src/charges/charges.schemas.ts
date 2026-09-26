import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import { z } from 'zod'

export const newChargeSchema = z.strictObject({ until: isoDateSchema.optional() })

export type NewCharge = z.infer<typeof newChargeSchema>

export const chargeParamsSchema = z.object({ chargeId: z.uuid() })

export const chargeListQuerySchema = z.object({ contactId: z.uuid().optional() })
