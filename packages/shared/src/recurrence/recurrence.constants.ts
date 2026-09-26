export const RECURRENCE_FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const MAX_RECURRENCE_INTERVAL = 52

export const MAX_RECURRENCE_BUSINESS_DAY = 10

export const DAYS_A_DUE_DATE_MAY_SHIFT = 10

export const RECURRING_ENTRY_TYPES = ['expense', 'income', 'card_purchase', 'transfer'] as const

export type RecurringEntryType = (typeof RECURRING_ENTRY_TYPES)[number]

export const MAX_REMIND_DAYS_BEFORE = 30

export const RECURRENCE_DESCRIPTION_MAX_LENGTH = 200
