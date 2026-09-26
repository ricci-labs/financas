export const RECURRENCE_FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const MAX_RECURRENCE_INTERVAL = 52

export const MAX_RECURRENCE_BUSINESS_DAY = 10

export const DAYS_A_DUE_DATE_MAY_SHIFT = 10

export const RECURRING_ENTRY_TYPES = ['expense', 'income', 'card_purchase', 'transfer'] as const

export type RecurringEntryType = (typeof RECURRING_ENTRY_TYPES)[number]

export const MAX_REMIND_DAYS_BEFORE = 30

export const RECURRENCE_DESCRIPTION_MAX_LENGTH = 200

export const OCCURRENCE_STATUSES = ['pending', 'matched', 'skipped'] as const

export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number]

export const OCCURRENCE_HORIZON_MONTHS = 6

export const MAX_OCCURRENCE_LIST_DAYS = 366

export const APPROXIMATE_DAYS_PER_STEP: Record<RecurrenceFrequency, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
}
