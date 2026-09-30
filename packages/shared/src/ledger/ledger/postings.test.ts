import { planPostings } from '@shared/ledger/ledger/postings'
import type {
  AccountRef,
  EntryPlan,
  PlanOf,
  PostingsPlan,
} from '@shared/ledger/ledger/postings.types'
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
      shares: [],
      receivable: null,
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
      shares: [],
      receivable: null,
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
          invoiceId: null,
          installmentNo: null,
          contactId: null,
        },
        {
          lineNo: 2,
          accountId: 'checking',
          accountKind: 'checking',
          amountCents: -100,
          effectiveOn: DAY,
          invoiceId: null,
          installmentNo: null,
          contactId: null,
        },
      ],
    })
  })

  it('always balances', () => {
    const plans: EntryPlan[] = [
      {
        entryType: 'expense',
        shares: [],
        receivable: null,
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
        shares: [],
        receivable: null,
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
        shares: [],
        receivable: null,
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
        shares: [],
        receivable: null,
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
        shares: [],
        receivable: null,
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
        shares: [],
        receivable: null,
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

describe('planPostings for cards', () => {
  const octInvoice = { invoiceId: 'inv-oct', effectiveOn: '2026-10-10' }
  const novInvoice = { invoiceId: 'inv-nov', effectiveOn: '2026-11-10' }
  const decInvoice = { invoiceId: 'inv-dec', effectiveOn: '2026-12-10' }
  const electronics: AccountRef = { id: 'electronics', kind: 'expense_category' }

  function cardLines(plan: PostingsPlan) {
    if (!plan.ok) {
      throw new Error(`Unexpected violation ${plan.violation}`)
    }
    return plan.postings.map(
      ({ accountId, amountCents, invoiceId, installmentNo, effectiveOn }) => [
        accountId,
        amountCents,
        invoiceId,
        installmentNo,
        effectiveOn,
      ],
    )
  }

  it('2. a TV for R$ 1.200,00 in 3x: one card line per invoice, expense per installment', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      shares: [],
      receivable: null,
      occurredOn: '2026-09-15',
      amountCents: 120000,
      card,
      category: electronics,
      installmentCount: 3,
      firstInstallment: 1,
      installments: [octInvoice, novInvoice, decInvoice],
    })
    expect(cardLines(plan)).toEqual([
      ['card', -40000, 'inv-oct', 1, '2026-10-10'],
      ['card', -40000, 'inv-nov', 2, '2026-11-10'],
      ['card', -40000, 'inv-dec', 3, '2026-12-10'],
      ['electronics', 40000, null, 1, '2026-10-10'],
      ['electronics', 40000, null, 2, '2026-11-10'],
      ['electronics', 40000, null, 3, '2026-12-10'],
    ])
  })

  it('puts the rounding cents on the first installment (R$ 1.000,00 in 3x)', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      shares: [],
      receivable: null,
      occurredOn: '2026-09-15',
      amountCents: 100000,
      card,
      category: groceries,
      installmentCount: 3,
      firstInstallment: 1,
      installments: [octInvoice, novInvoice, decInvoice],
    })
    const cardAmounts = cardLines(plan)
      .filter(([accountId]) => accountId === 'card')
      .map(([, amount]) => amount)
    expect(cardAmounts).toEqual([-33334, -33333, -33333])
  })

  it('records only the remaining installments of a purchase already in progress', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      shares: [],
      receivable: null,
      occurredOn: '2026-04-15',
      amountCents: 100000,
      card,
      category: electronics,
      installmentCount: 3,
      firstInstallment: 2,
      installments: [octInvoice, novInvoice],
    })
    expect(cardLines(plan)).toEqual([
      ['card', -33333, 'inv-oct', 2, '2026-10-10'],
      ['card', -33333, 'inv-nov', 3, '2026-11-10'],
      ['electronics', 33333, null, 2, '2026-10-10'],
      ['electronics', 33333, null, 3, '2026-11-10'],
    ])
  })

  it('5. paying R$ 400,00 of the October invoice from checking', () => {
    const plan = planPostings({
      entryType: 'invoice_payment',
      occurredOn: '2026-10-10',
      amountCents: 40000,
      card,
      invoiceId: 'inv-oct',
      paidFrom: checking,
    })
    expect(cardLines(plan)).toEqual([
      ['card', 40000, 'inv-oct', null, '2026-10-10'],
      ['checking', -40000, null, null, '2026-10-10'],
    ])
  })

  it.each([
    [
      'a purchase on an account that is not a card',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 100,
        card: checking,
        category: groceries,
        installmentCount: 1,
        firstInstallment: 1,
        installments: [octInvoice],
      },
      'NOT_A_CARD',
    ],
    [
      'a purchase without installments',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 100,
        card,
        category: groceries,
        installmentCount: 1,
        firstInstallment: 1,
        installments: [],
      },
      'NO_INSTALLMENTS',
    ],
    [
      'more installments than cents',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 2,
        card,
        category: groceries,
        installmentCount: 3,
        firstInstallment: 1,
        installments: [octInvoice, novInvoice, decInvoice],
      },
      'TOO_MANY_INSTALLMENTS',
    ],
    [
      'a purchase on an income category',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 100,
        card,
        category: salary,
        installmentCount: 1,
        firstInstallment: 1,
        installments: [octInvoice],
      },
      'NOT_AN_EXPENSE_CATEGORY',
    ],
    [
      'a first installment after the last one',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 100,
        card,
        category: groceries,
        installmentCount: 3,
        firstInstallment: 4,
        installments: [octInvoice],
      },
      'FIRST_INSTALLMENT_OUT_OF_RANGE',
    ],
    [
      'targets that do not match the remaining installments',
      {
        entryType: 'card_purchase',
        shares: [],
        receivable: null,
        occurredOn: DAY,
        amountCents: 100,
        card,
        category: groceries,
        installmentCount: 3,
        firstInstallment: 2,
        installments: [octInvoice],
      },
      'INSTALLMENTS_DO_NOT_MATCH',
    ],
    [
      'a payment from a category',
      {
        entryType: 'invoice_payment',
        occurredOn: DAY,
        amountCents: 100,
        card,
        invoiceId: 'inv-oct',
        paidFrom: groceries,
      },
      'NOT_A_MONEY_ACCOUNT',
    ],
  ] as [string, EntryPlan, string][])('refuses %s', (_case, plan, violation) => {
    expect(planPostings(plan)).toEqual({ ok: false, violation })
  })
})

describe('planPostings with contacts (ledger.md examples 2 and 3)', () => {
  const receivable: AccountRef = { id: 'receivable', kind: 'receivable' }
  const dining: AccountRef = { id: 'dining', kind: 'expense_category' }
  const electronics: AccountRef = { id: 'electronics', kind: 'expense_category' }
  const installments = [
    { invoiceId: 'inv-oct', effectiveOn: '2026-10-10' },
    { invoiceId: 'inv-nov', effectiveOn: '2026-11-10' },
    { invoiceId: 'inv-dec', effectiveOn: '2026-12-10' },
  ]

  function lines(plan: PostingsPlan) {
    if (!plan.ok) {
      throw new Error(`Unexpected violation ${plan.violation}`)
    }
    return plan.postings.map(({ accountId, amountCents, contactId, installmentNo }) => [
      accountId,
      amountCents,
      contactId,
      installmentNo,
    ])
  }

  const dinner = (shares: { contactId: string; amountCents: number }[]): PlanOf<'expense'> => ({
    entryType: 'expense',
    occurredOn: DAY,
    amountCents: 30_000,
    paidFrom: checking,
    category: dining,
    shares,
    receivable,
  })

  it('3. a dinner of R$ 300,00 where J and M owe R$ 100,00 each', () => {
    const plan = planPostings(
      dinner([
        { contactId: 'j', amountCents: 10_000 },
        { contactId: 'm', amountCents: 10_000 },
      ]),
    )
    expect(lines(plan)).toEqual([
      ['dining', 10_000, null, null],
      ['receivable', 10_000, 'j', null],
      ['receivable', 10_000, 'm', null],
      ['checking', -30_000, null, null],
    ])
  })

  it('leaves no own line when a contact owes it all', () => {
    const plan = planPostings(dinner([{ contactId: 'j', amountCents: 30_000 }]))
    expect(lines(plan)).toEqual([
      ['receivable', 30_000, 'j', null],
      ['checking', -30_000, null, null],
    ])
  })

  it('2. a TV of R$ 1.200,00 in 3x where J owes R$ 300,00: each share spread over the installments', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      occurredOn: '2026-09-15',
      amountCents: 120_000,
      card,
      category: electronics,
      installmentCount: 3,
      firstInstallment: 1,
      installments,
      shares: [{ contactId: 'j', amountCents: 30_000 }],
      receivable,
    })
    expect(lines(plan)).toEqual([
      ['card', -40_000, null, 1],
      ['card', -40_000, null, 2],
      ['card', -40_000, null, 3],
      ['electronics', 30_000, null, 1],
      ['receivable', 10_000, 'j', 1],
      ['electronics', 30_000, null, 2],
      ['receivable', 10_000, 'j', 2],
      ['electronics', 30_000, null, 3],
      ['receivable', 10_000, 'j', 3],
    ])
  })

  it('puts a card purchase that is all theirs on the contact only', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      occurredOn: '2026-09-15',
      amountCents: 60_000,
      card,
      category: electronics,
      installmentCount: 2,
      firstInstallment: 1,
      installments: installments.slice(0, 2),
      shares: [{ contactId: 'j', amountCents: 60_000 }],
      receivable,
    })
    expect(lines(plan)).toEqual([
      ['card', -30_000, null, 1],
      ['card', -30_000, null, 2],
      ['receivable', 30_000, 'j', 1],
      ['receivable', 30_000, 'j', 2],
    ])
  })

  it('keeps only the remaining installments of a purchase already in progress', () => {
    const plan = planPostings({
      entryType: 'card_purchase',
      occurredOn: '2026-09-15',
      amountCents: 120_000,
      card,
      category: electronics,
      installmentCount: 3,
      firstInstallment: 3,
      installments: [installments[2] ?? { invoiceId: 'x', effectiveOn: DAY }],
      shares: [{ contactId: 'j', amountCents: 30_000 }],
      receivable,
    })
    expect(lines(plan)).toEqual([
      ['card', -40_000, null, 3],
      ['electronics', 30_000, null, 3],
      ['receivable', 10_000, 'j', 3],
    ])
  })

  it('refuses shares without the receivable account, not positive, twice the same contact or above the amount', () => {
    const violation = (plan: EntryPlan) => {
      const result = planPostings(plan)
      return result.ok ? null : result.violation
    }
    expect(violation({ ...dinner([{ contactId: 'j', amountCents: 1 }]), receivable: null })).toBe(
      'NOT_THE_RECEIVABLE_ACCOUNT',
    )
    expect(violation(dinner([{ contactId: 'j', amountCents: 0 }]))).toBe('SHARE_NOT_POSITIVE')
    expect(
      violation(
        dinner([
          { contactId: 'j', amountCents: 1 },
          { contactId: 'j', amountCents: 1 },
        ]),
      ),
    ).toBe('CONTACT_TWICE')
    expect(violation(dinner([{ contactId: 'j', amountCents: 30_001 }]))).toBe(
      'SHARES_EXCEED_AMOUNT',
    )
  })
})

describe('planPostings for a settlement (ledger.md example 4)', () => {
  const receivable: AccountRef = { id: 'receivable', kind: 'receivable' }

  it('4. J pays R$ 100,00 back by Pix: money in, J owes less', () => {
    const plan = planPostings({
      entryType: 'settlement',
      occurredOn: DAY,
      amountCents: 10_000,
      contactId: 'j',
      receivedIn: checking,
      receivable,
    })
    if (!plan.ok) {
      throw new Error(plan.violation)
    }
    expect(
      plan.postings.map(({ accountId, amountCents, contactId }) => [
        accountId,
        amountCents,
        contactId,
      ]),
    ).toEqual([
      ['checking', 10_000, null],
      ['receivable', -10_000, 'j'],
    ])
  })

  it('refuses money arriving anywhere but a money account', () => {
    const plan = planPostings({
      entryType: 'settlement',
      occurredOn: DAY,
      amountCents: 10_000,
      contactId: 'j',
      receivedIn: groceries,
      receivable,
    })
    expect(plan).toEqual({ ok: false, violation: 'NOT_A_MONEY_ACCOUNT' })
  })
})
