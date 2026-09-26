import { MAX_INSTALLMENTS } from '@shared/ledger/ledger.constants'
import { isoDateSchema } from '@shared/ledger/ledger.schemas'
import { z } from 'zod'

export const purchaseSimulationQuerySchema = z
  .object({
    amountCents: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    installmentCount: z.coerce.number().int().min(1).max(MAX_INSTALLMENTS).default(1),
    cardAccountId: z.uuid().optional(),
    paidFromAccountId: z.uuid().optional(),
    occurredOn: isoDateSchema.optional(),
  })
  .refine(
    (query) => (query.cardAccountId === undefined) !== (query.paidFromAccountId === undefined),
    {
      message: 'Choose a card or an account',
      path: ['cardAccountId'],
    },
  )
  .refine((query) => query.cardAccountId !== undefined || query.installmentCount === 1, {
    message: 'Only a card splits a purchase in installments',
    path: ['installmentCount'],
  })

export type PurchaseSimulationQuery = z.infer<typeof purchaseSimulationQuerySchema>
