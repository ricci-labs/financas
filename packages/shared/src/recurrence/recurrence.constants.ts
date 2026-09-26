export const RECURRENCE_FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const MAX_RECURRENCE_INTERVAL = 52

export const MAX_RECURRENCE_BUSINESS_DAY = 10

export const DAYS_A_DUE_DATE_MAY_SHIFT = 10
