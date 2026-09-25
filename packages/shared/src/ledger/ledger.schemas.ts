import { parseIsoDate } from '@shared/calendar/dates'
import {
  INCOME_NATURES,
  PAYMENT_METHODS,
  USER_ACCOUNT_KINDS,
} from '@shared/ledger/ledger.constants'
import { z } from 'zod'

export const ENTRY_DESCRIPTION_MAX_LENGTH = 200

export const ENTRY_NOTES_MAX_LENGTH = 2000

export const ACCOUNT_NAME_MAX_LENGTH = 80

export const ACCOUNT_ICON_MAX_LENGTH = 40

export const ACCOUNT_SORT_ORDER_MAX = 32_767

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

const accountNameSchema = z.string().trim().min(1).max(ACCOUNT_NAME_MAX_LENGTH)

const accountPersonalizationSchema = z.object({
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  icon: z.string().trim().min(1).max(ACCOUNT_ICON_MAX_LENGTH).nullish(),
  sortOrder: z.number().int().min(0).max(ACCOUNT_SORT_ORDER_MAX).optional(),
})

export const newAccountSchema = accountPersonalizationSchema
  .extend({
    kind: z.enum(USER_ACCOUNT_KINDS),
    name: accountNameSchema,
    parentId: z.uuid().nullish(),
    incomeNature: z.enum(INCOME_NATURES).nullish(),
    ownerUserId: z.uuid().nullish(),
  })
  .refine((account) => (account.kind === 'income_category') === Boolean(account.incomeNature), {
    message: 'Income nature is required on income categories and only there',
    path: ['incomeNature'],
  })

export type NewAccountInput = z.infer<typeof newAccountSchema>

export const accountChangeSchema = accountPersonalizationSchema
  .extend({
    name: accountNameSchema.optional(),
    parentId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().nullable().optional(),
  })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    message: 'Nothing to change',
  })

export type AccountChange = z.infer<typeof accountChangeSchema>
