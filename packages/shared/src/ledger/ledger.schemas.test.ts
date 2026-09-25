import { entryDetailsChangeSchema, entryInputSchema } from '@shared/ledger/ledger.schemas'
import { describe, expect, it } from 'vitest'

const ACCOUNT = '01a0d8ce-060b-7dd3-a56f-5995e1676b98'
const CATEGORY = '01a0d8ce-085c-7390-a823-d76b28f1ff07'

const expense = {
  entryType: 'expense',
  occurredOn: '2026-10-05',
  description: '  Mercado  ',
  amountCents: 8750,
  paidFromAccountId: ACCOUNT,
  categoryId: CATEGORY,
}

describe('entryInputSchema', () => {
  it('accepts an expense and trims the description', () => {
    const parsed = entryInputSchema.parse(expense)
    expect(parsed).toMatchObject({
      entryType: 'expense',
      description: 'Mercado',
      amountCents: 8750,
    })
  })

  it('accepts a negative opening balance', () => {
    const parsed = entryInputSchema.safeParse({
      entryType: 'opening_balance',
      occurredOn: '2026-10-01',
      description: 'Saldo inicial',
      balanceCents: -5000,
      accountId: ACCOUNT,
    })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ['a date that does not exist', { occurredOn: '2026-02-30' }],
    ['a blank description', { description: '   ' }],
    ['fractional cents', { amountCents: 87.5 }],
    ['a negative amount', { amountCents: -100 }],
    ['an account id that is not a uuid', { paidFromAccountId: 'checking' }],
    ['an unknown payment method', { paymentMethod: 'cheque' }],
  ])('refuses %s', (_case, change) => {
    expect(entryInputSchema.safeParse({ ...expense, ...change }).success).toBe(false)
  })

  it('refuses an expense without its category', () => {
    const { categoryId: _, ...withoutCategory } = expense
    expect(entryInputSchema.safeParse(withoutCategory).success).toBe(false)
  })

  it('refuses a zero opening balance', () => {
    const zero = {
      entryType: 'opening_balance',
      occurredOn: '2026-10-01',
      description: 'Saldo inicial',
      balanceCents: 0,
      accountId: ACCOUNT,
    }
    expect(entryInputSchema.safeParse(zero).success).toBe(false)
  })
})

describe('entryDetailsChangeSchema', () => {
  it('accepts a new description or new notes', () => {
    expect(entryDetailsChangeSchema.safeParse({ description: 'Feira' }).success).toBe(true)
    expect(entryDetailsChangeSchema.safeParse({ notes: null }).success).toBe(true)
  })

  it('refuses an empty change', () => {
    expect(entryDetailsChangeSchema.safeParse({}).success).toBe(false)
  })
})
