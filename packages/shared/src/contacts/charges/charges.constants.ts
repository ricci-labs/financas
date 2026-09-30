export const CHARGE_STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'cancelled'] as const

export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

export const OPEN_CHARGE_STATUSES: readonly ChargeStatus[] = ['draft', 'sent', 'partially_paid']
