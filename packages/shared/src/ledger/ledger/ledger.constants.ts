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

export const ENTRY_TYPES = [
  'expense',
  'income',
  'card_purchase',
  'transfer',
  'invoice_payment',
  'refund',
  'settlement',
  'adjustment',
  'opening_balance',
] as const

export type EntryType = (typeof ENTRY_TYPES)[number]

export const PAYMENT_METHODS = [
  'pix',
  'debit',
  'credit',
  'cash',
  'boleto',
  'bank_transfer',
  'auto_debit',
  'other',
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const ENTRY_SOURCES = ['web', 'whatsapp', 'job', 'import'] as const

export type EntrySource = (typeof ENTRY_SOURCES)[number]

export const MONEY_ACCOUNT_KINDS = ['checking', 'savings', 'cash_wallet', 'investment'] as const

export type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number]

export const USER_ACCOUNT_KINDS = [
  'checking',
  'savings',
  'cash_wallet',
  'investment',
  'loan',
  'income_category',
  'expense_category',
] as const

export type UserAccountKind = (typeof USER_ACCOUNT_KINDS)[number]

export const INVOICE_STATUSES = ['future', 'open', 'closed'] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const ENTRY_TYPES_ALLOWED_ON_CLOSED_INVOICES = [
  'adjustment',
  'invoice_payment',
  'refund',
] as const

export const MAX_INSTALLMENTS = 48
