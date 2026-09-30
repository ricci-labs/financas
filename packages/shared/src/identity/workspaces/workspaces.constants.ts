export const PERIOD_ANCHORS = ['calendar_month', 'day_of_month', 'nth_business_day'] as const

export type PeriodAnchor = (typeof PERIOD_ANCHORS)[number]

export const INSTALLMENT_BUDGET_VIEWS = ['purchase_month', 'per_installment'] as const

export type InstallmentBudgetView = (typeof INSTALLMENT_BUDGET_VIEWS)[number]

export const BUDGET_BASES = ['fixed_income', 'all_income'] as const

export type BudgetBase = (typeof BUDGET_BASES)[number]

export const MAX_ANCHOR_DAY_OF_MONTH = 31

export const MAX_ANCHOR_BUSINESS_DAY = 10
