import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import { z } from 'zod'

export const newChargeSchema = z.strictObject({ until: isoDateSchema.optional() })

export type NewCharge = z.infer<typeof newChargeSchema>

export const chargeParamsSchema = z.object({ chargeId: z.uuid() })

export const chargeListQuerySchema = z.object({ contactId: z.uuid().optional() })

export const chargePaymentSchema = z.strictObject({
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  receivedInAccountId: z.uuid(),
  occurredOn: isoDateSchema,
})

export type ChargePayment = z.infer<typeof chargePaymentSchema>
