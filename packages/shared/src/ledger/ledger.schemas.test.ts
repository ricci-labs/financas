import {
  accountChangeSchema,
  cardChangeSchema,
  entryDetailsChangeSchema,
  entryInputSchema,
  newAccountSchema,
  newCardSchema,
} from '@shared/ledger/ledger.schemas'
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

describe('newAccountSchema', () => {
  it('accepts a category under a parent and trims the name', () => {
    const parsed = newAccountSchema.parse({
      kind: 'expense_category',
      name: '  Mercado ',
      parentId: ACCOUNT,
      color: '#00AA00',
    })
    expect(parsed).toMatchObject({ name: 'Mercado', parentId: ACCOUNT })
  })

  it('requires the income nature on income categories and only there', () => {
    expect(newAccountSchema.safeParse({ kind: 'income_category', name: 'Salário' }).success).toBe(
      false,
    )
    expect(
      newAccountSchema.safeParse({
        kind: 'income_category',
        name: 'Salário',
        incomeNature: 'fixed',
      }).success,
    ).toBe(true)
    expect(
      newAccountSchema.safeParse({ kind: 'checking', name: 'Conta', incomeNature: 'fixed' })
        .success,
    ).toBe(false)
  })

  it.each(['receivable', 'opening_balance', 'credit_card'])(
    'refuses creating a %s account here',
    (kind) => {
      expect(newAccountSchema.safeParse({ kind, name: 'X' }).success).toBe(false)
    },
  )

  it('refuses a color that is not #rrggbb', () => {
    expect(
      newAccountSchema.safeParse({ kind: 'checking', name: 'X', color: 'green' }).success,
    ).toBe(false)
  })
})

describe('accountChangeSchema', () => {
  it('accepts moving to the root and renaming', () => {
    expect(accountChangeSchema.safeParse({ parentId: null }).success).toBe(true)
    expect(accountChangeSchema.safeParse({ name: 'Feira' }).success).toBe(true)
  })

  it('refuses an empty change', () => {
    expect(accountChangeSchema.safeParse({}).success).toBe(false)
  })
})

describe('newCardSchema', () => {
  it('accepts a card with its cycle', () => {
    const parsed = newCardSchema.safeParse({ name: 'Cartão X', closingDay: 3, dueDay: 10 })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ['a closing day of 0', { closingDay: 0 }],
    ['a due day of 32', { dueDay: 32 }],
    ['a zero limit', { limitCents: 0 }],
  ])('refuses %s', (_case, change) => {
    const card = { name: 'Cartão X', closingDay: 3, dueDay: 10, ...change }
    expect(newCardSchema.safeParse(card).success).toBe(false)
  })
})

describe('cardChangeSchema', () => {
  it('accepts removing the limit and refuses an empty change', () => {
    expect(cardChangeSchema.safeParse({ limitCents: null }).success).toBe(true)
    expect(cardChangeSchema.safeParse({}).success).toBe(false)
  })
})
