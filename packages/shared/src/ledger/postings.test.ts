import { planPostings } from '@shared/ledger/postings'
import type { AccountRef, EntryPlan, PostingsPlan } from '@shared/ledger/postings.types'
import { describe, expect, it } from 'vitest'

const DAY = '2026-10-05'
const checking: AccountRef = { id: 'checking', kind: 'checking' }
const savings: AccountRef = { id: 'savings', kind: 'savings' }
const groceries: AccountRef = { id: 'groceries', kind: 'expense_category' }
const salary: AccountRef = { id: 'salary', kind: 'income_category' }
const openingBalance: AccountRef = { id: 'opening', kind: 'opening_balance' }
const card: AccountRef = { id: 'card', kind: 'credit_card' }

function amounts(plan: PostingsPlan) {
  if (!plan.ok) {
    throw new Error(`Unexpected violation ${plan.violation}`)
  }
  return plan.postings.map(({ accountId, amountCents }) => [accountId, amountCents])
}

describe('planPostings (worked examples in docs/domain/model/ledger.md)', () => {
  it('1. an expense by Pix: R$ 87,50 at the grocery store', () => {
    const plan = planPostings({
      entryType: 'expense',
      occurredOn: DAY,
      amountCents: 8750,
      paidFrom: checking,
      category: groceries,
    })
    expect(amounts(plan)).toEqual([
      ['groceries', 8750],
      ['checking', -8750],
    ])
  })

  it('6. moving R$ 1.000,00 to the reserve', () => {
    const plan = planPostings({
      entryType: 'transfer',
      occurredOn: DAY,
      amountCents: 100000,
      from: checking,
      to: savings,
    })
    expect(amounts(plan)).toEqual([
      ['savings', 100000],
      ['checking', -100000],
    ])
  })

  it('8. checking starts with R$ 2.000,00', () => {
    const plan = planPostings({
      entryType: 'opening_balance',
      occurredOn: DAY,
      balanceCents: 200000,
      account: checking,
      openingBalanceAccount: openingBalance,
    })
    expect(amounts(plan)).toEqual([
      ['checking', 200000],
      ['opening', -200000],
    ])
  })
})

describe('planPostings', () => {
  it('records income as money in and income credited', () => {
    const plan = planPostings({
      entryType: 'income',
      occurredOn: DAY,
      amountCents: 500000,
      receivedIn: checking,
      category: salary,
    })
    expect(amounts(plan)).toEqual([
      ['checking', 500000],
      ['salary', -500000],
    ])
  })

  it('accepts a negative opening balance (overdraft)', () => {
    const plan = planPostings({
      entryType: 'opening_balance',
      occurredOn: DAY,
      balanceCents: -5000,
      account: checking,
      openingBalanceAccount: openingBalance,
    })
    expect(amounts(plan)).toEqual([
      ['checking', -5000],
      ['opening', 5000],
    ])
  })

  it('numbers the lines, keeps the account kinds and uses the day as effective date', () => {
    const plan = planPostings({
      entryType: 'expense',
      occurredOn: DAY,
      amountCents: 100,
      paidFrom: checking,
      category: groceries,
    })
    expect(plan).toEqual({
      ok: true,
      postings: [
        {
          lineNo: 1,
          accountId: 'groceries',
          accountKind: 'expense_category',
          amountCents: 100,
          effectiveOn: DAY,
        },
        {
          lineNo: 2,
          accountId: 'checking',
          accountKind: 'checking',
          amountCents: -100,
          effectiveOn: DAY,
        },
      ],
    })
  })

  it('always balances', () => {
    const plans: EntryPlan[] = [
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 1,
        paidFrom: savings,
        category: groceries,
      },
      {
        entryType: 'income',
        occurredOn: DAY,
        amountCents: 99,
        receivedIn: savings,
        category: salary,
      },
      { entryType: 'transfer', occurredOn: DAY, amountCents: 7, from: savings, to: checking },
    ]
    for (const plan of plans) {
      const result = planPostings(plan)
      const sum = result.ok
        ? result.postings.reduce((total, line) => total + line.amountCents, 0)
        : NaN
      expect(sum).toBe(0)
    }
  })

  it.each([
    [
      'a zero amount',
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 0,
        paidFrom: checking,
        category: groceries,
      },
      'AMOUNT_NOT_POSITIVE',
    ],
    [
      'a fractional amount',
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 1.5,
        paidFrom: checking,
        category: groceries,
      },
      'AMOUNT_NOT_POSITIVE',
    ],
    [
      'an expense paid from a category',
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 100,
        paidFrom: salary,
        category: groceries,
      },
      'NOT_A_MONEY_ACCOUNT',
    ],
    [
      'an expense paid with a card (card purchases come later)',
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 100,
        paidFrom: card,
        category: groceries,
      },
      'NOT_A_MONEY_ACCOUNT',
    ],
    [
      'an expense on an income category',
      {
        entryType: 'expense',
        occurredOn: DAY,
        amountCents: 100,
        paidFrom: checking,
        category: salary,
      },
      'NOT_AN_EXPENSE_CATEGORY',
    ],
    [
      'income on an expense category',
      {
        entryType: 'income',
        occurredOn: DAY,
        amountCents: 100,
        receivedIn: checking,
        category: groceries,
      },
      'NOT_AN_INCOME_CATEGORY',
    ],
    [
      'a transfer to the same account',
      { entryType: 'transfer', occurredOn: DAY, amountCents: 100, from: checking, to: checking },
      'SAME_ACCOUNT',
    ],
    [
      'a zero opening balance',
      {
        entryType: 'opening_balance',
        occurredOn: DAY,
        balanceCents: 0,
        account: checking,
        openingBalanceAccount: openingBalance,
      },
      'BALANCE_IS_ZERO',
    ],
    [
      'an opening balance against another account',
      {
        entryType: 'opening_balance',
        occurredOn: DAY,
        balanceCents: 100,
        account: checking,
        openingBalanceAccount: savings,
      },
      'NOT_THE_OPENING_BALANCE_ACCOUNT',
    ],
  ] as [string, EntryPlan, string][])('refuses %s', (_case, plan, violation) => {
    expect(planPostings(plan)).toEqual({ ok: false, violation })
  })
})
