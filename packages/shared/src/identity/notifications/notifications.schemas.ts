import { isoDateSchema } from '@shared/ledger/ledger/ledger.schemas'
import { z } from 'zod'

export const billReminderPayloadSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
  isEstimate: z.boolean(),
  dueOn: isoDateSchema,
})

export type BillReminderPayload = z.infer<typeof billReminderPayloadSchema>

export const invoiceReminderPayloadSchema = z.object({
  cardName: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  dueOn: isoDateSchema,
})

export type InvoiceReminderPayload = z.infer<typeof invoiceReminderPayloadSchema>
