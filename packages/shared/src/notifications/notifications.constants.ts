export const NOTIFICATION_KINDS = [
  'bill_reminder',
  'invoice_reminder',
  'charge',
  'charge_reminder',
  'budget_alert',
  'variable_income_suggestion',
  'digest',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const NOTIFICATION_STATUSES = ['pending', 'sending', 'sent', 'failed', 'cancelled'] as const

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]
