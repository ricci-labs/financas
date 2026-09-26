import { recurringAccountsFit } from '@shared/recurrence/recurring-accounts'
import { describe, expect, it } from 'vitest'

const checking = { id: 'checking', kind: 'checking' as const }
const savings = { id: 'savings', kind: 'savings' as const }
const card = { id: 'card', kind: 'credit_card' as const }
const rent = { id: 'rent', kind: 'expense_category' as const }
const salary = { id: 'salary', kind: 'income_category' as const }

describe('recurringAccountsFit', () => {
  it('accepts the accounts each kind of recurring entry moves', () => {
    expect(recurringAccountsFit('expense', checking, rent)).toBe(true)
    expect(recurringAccountsFit('income', checking, salary)).toBe(true)
    expect(recurringAccountsFit('card_purchase', card, rent)).toBe(true)
    expect(recurringAccountsFit('transfer', checking, savings)).toBe(true)
  })

  it('refuses accounts of the wrong kind, and a transfer to the same account', () => {
    expect(recurringAccountsFit('expense', card, rent)).toBe(false)
    expect(recurringAccountsFit('expense', checking, salary)).toBe(false)
    expect(recurringAccountsFit('income', checking, rent)).toBe(false)
    expect(recurringAccountsFit('card_purchase', checking, rent)).toBe(false)
    expect(recurringAccountsFit('transfer', checking, rent)).toBe(false)
    expect(recurringAccountsFit('transfer', checking, checking)).toBe(false)
  })
})
