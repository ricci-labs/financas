import { ACCOUNT_CLASS_BY_KIND, accountClassOf, isSystemAccountKind } from '@shared/ledger/ledger'
import { ACCOUNT_KINDS } from '@shared/ledger/ledger.constants'
import { describe, expect, it } from 'vitest'

describe('account classes', () => {
  it('gives every kind a class', () => {
    expect(Object.keys(ACCOUNT_CLASS_BY_KIND).sort()).toEqual([...ACCOUNT_KINDS].sort())
  })

  it.each([
    ['checking', 'asset'],
    ['receivable', 'asset'],
    ['credit_card', 'liability'],
    ['payable', 'liability'],
    ['income_category', 'income'],
    ['expense_category', 'expense'],
    ['opening_balance', 'equity'],
  ] as const)('classifies %s as %s', (kind, expected) => {
    expect(accountClassOf(kind)).toBe(expected)
  })
})

describe('system accounts', () => {
  it('are the receivable, the payable and the opening balance', () => {
    const systemKinds = ACCOUNT_KINDS.filter(isSystemAccountKind)
    expect(systemKinds).toEqual(['receivable', 'payable', 'opening_balance'])
  })
})
