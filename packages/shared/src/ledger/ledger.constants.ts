export const ACCOUNT_KINDS = [
  'checking',
  'savings',
  'cash_wallet',
  'investment',
  'receivable',
  'credit_card',
  'loan',
  'payable',
  'income_category',
  'expense_category',
  'opening_balance',
] as const

export type AccountKind = (typeof ACCOUNT_KINDS)[number]

export const ACCOUNT_CLASSES = ['asset', 'liability', 'income', 'expense', 'equity'] as const

export type AccountClass = (typeof ACCOUNT_CLASSES)[number]

export const INCOME_NATURES = ['fixed', 'variable'] as const

export type IncomeNature = (typeof INCOME_NATURES)[number]

export const SYSTEM_ACCOUNT_KINDS = ['receivable', 'payable', 'opening_balance'] as const

export type SystemAccountKind = (typeof SYSTEM_ACCOUNT_KINDS)[number]
