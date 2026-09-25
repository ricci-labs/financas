import type { AccountClass, AccountKind, SystemAccountKind } from '@shared/ledger/ledger.constants'
import { SYSTEM_ACCOUNT_KINDS } from '@shared/ledger/ledger.constants'

export const ACCOUNT_CLASS_BY_KIND: Readonly<Record<AccountKind, AccountClass>> = {
  checking: 'asset',
  savings: 'asset',
  cash_wallet: 'asset',
  investment: 'asset',
  receivable: 'asset',
  credit_card: 'liability',
  loan: 'liability',
  payable: 'liability',
  income_category: 'income',
  expense_category: 'expense',
  opening_balance: 'equity',
}

export const SYSTEM_ACCOUNT_NAMES: Readonly<Record<SystemAccountKind, string>> = {
  receivable: 'A receber',
  payable: 'A pagar',
  opening_balance: 'Saldo inicial',
}

export function accountClassOf(kind: AccountKind): AccountClass {
  return ACCOUNT_CLASS_BY_KIND[kind]
}

export function isSystemAccountKind(kind: AccountKind): kind is SystemAccountKind {
  return (SYSTEM_ACCOUNT_KINDS as readonly AccountKind[]).includes(kind)
}
