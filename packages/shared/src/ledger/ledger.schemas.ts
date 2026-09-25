import { parseIsoDate } from '@shared/calendar/dates'
import { PAYMENT_METHODS } from '@shared/ledger/ledger.constants'
import { z } from 'zod'

export const ENTRY_DESCRIPTION_MAX_LENGTH = 200

export const ENTRY_NOTES_MAX_LENGTH = 2000

function isCalendarDate(value: string): boolean {
  try {
    parseIsoDate(value)
    return true
  } catch {
    return false
  }
}

export const isoDateSchema = z.string().refine(isCalendarDate, 'Invalid calendar date')

const positiveCentsSchema = z.number().int().positive()

const accountIdSchema = z.uuid()

const entryDetailsSchema = z.object({
  occurredOn: isoDateSchema,
  description: z.string().trim().min(1).max(ENTRY_DESCRIPTION_MAX_LENGTH),
  notes: z.string().trim().max(ENTRY_NOTES_MAX_LENGTH).nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  spentByUserId: z.uuid().nullish(),
})

export const entryInputSchema = z.discriminatedUnion('entryType', [
  entryDetailsSchema.extend({
    entryType: z.literal('expense'),
    amountCents: positiveCentsSchema,
    paidFromAccountId: accountIdSchema,
    categoryId: accountIdSchema,
  }),
  entryDetailsSchema.extend({
    entryType: z.literal('income'),
    amountCents: positiveCentsSchema,
    receivedInAccountId: accountIdSchema,
    categoryId: accountIdSchema,
  }),
  entryDetailsSchema.extend({
    entryType: z.literal('transfer'),
    amountCents: positiveCentsSchema,
    fromAccountId: accountIdSchema,
    toAccountId: accountIdSchema,
  }),
  entryDetailsSchema.extend({
    entryType: z.literal('opening_balance'),
    balanceCents: z
      .number()
      .int()
      .refine((value) => value !== 0, 'Balance must not be zero'),
    accountId: accountIdSchema,
  }),
])

export type EntryInput = z.infer<typeof entryInputSchema>

export const entryDetailsChangeSchema = z
  .object({
    description: entryDetailsSchema.shape.description.optional(),
    notes: entryDetailsSchema.shape.notes,
  })
  .refine((change) => change.description !== undefined || change.notes !== undefined, {
    message: 'Nothing to change',
  })

export type EntryDetailsChange = z.infer<typeof entryDetailsChangeSchema>
