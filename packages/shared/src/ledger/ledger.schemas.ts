import { parseIsoDate } from '@shared/calendar/dates'
import {
  INCOME_NATURES,
  MAX_INSTALLMENTS,
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
    entryType: z.literal('card_purchase'),
    amountCents: positiveCentsSchema,
    installmentCount: z.number().int().min(1).max(MAX_INSTALLMENTS).default(1),
    firstInstallment: z.number().int().min(1).max(MAX_INSTALLMENTS).default(1),
    cardAccountId: accountIdSchema,
    categoryId: accountIdSchema,
  }),
  entryDetailsSchema.extend({
    entryType: z.literal('invoice_payment'),
    amountCents: positiveCentsSchema,
    cardAccountId: accountIdSchema,
    invoiceId: z.uuid(),
    paidFromAccountId: accountIdSchema.nullish(),
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

export const ENTRY_LIST_DEFAULT_LIMIT = 100

export const ENTRY_LIST_MAX_LIMIT = 500

export const entryParamsSchema = z.object({ entryId: z.uuid() })

export type EntryParams = z.infer<typeof entryParamsSchema>

export const entryListQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    accountId: z.uuid().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ENTRY_LIST_MAX_LIMIT)
      .default(ENTRY_LIST_DEFAULT_LIMIT),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must not be after to',
    path: ['from'],
  })

export type EntryListQuery = z.infer<typeof entryListQuerySchema>

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

export const accountParamsSchema = z.object({ accountId: z.uuid() })

export type AccountParams = z.infer<typeof accountParamsSchema>

const dayOfMonthSchema = z.number().int().min(1).max(31)

const cardCycleFields = {
  closingDay: dayOfMonthSchema,
  dueDay: dayOfMonthSchema,
  purchaseOnClosingDayGoesNext: z.boolean().optional(),
  limitCents: positiveCentsSchema.nullish(),
  holderUserId: z.uuid().nullish(),
  paymentAccountId: z.uuid().nullish(),
}

export const newCardSchema = accountPersonalizationSchema.extend({
  name: accountNameSchema,
  ...cardCycleFields,
})

export type NewCardInput = z.infer<typeof newCardSchema>

export const cardChangeSchema = z
  .object({
    closingDay: dayOfMonthSchema.optional(),
    dueDay: dayOfMonthSchema.optional(),
    purchaseOnClosingDayGoesNext: z.boolean().optional(),
    limitCents: positiveCentsSchema.nullable().optional(),
    holderUserId: z.uuid().nullable().optional(),
    paymentAccountId: z.uuid().nullable().optional(),
  })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    message: 'Nothing to change',
  })

export type CardChange = z.infer<typeof cardChangeSchema>

export const cardParamsSchema = z.object({ cardId: z.uuid() })

export type CardParams = z.infer<typeof cardParamsSchema>
