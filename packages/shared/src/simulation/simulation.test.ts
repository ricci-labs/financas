import type { FactOccurrence, PeriodFacts } from '@shared/metrics/metrics.types'
import { simulatePurchase, withPurchase } from '@shared/simulation/simulation'
import { purchaseSimulationQuerySchema } from '@shared/simulation/simulation.schemas'
import { describe, expect, it } from 'vitest'

const CARD = {
  accountId: 'card',
  paymentAccountId: 'checking',
  closingDay: 3,
  dueDay: 10,
  purchaseOnClosingDayGoesNext: true,
}

function occurrence(overrides: Partial<FactOccurrence>): FactOccurrence {
  return {
    id: crypto.randomUUID(),
    sourceAccountId: 'checking',
    dueOn: '2026-11-05',
    amountCents: 400_000,
    entryType: 'income',
    status: 'pending',
    categoryAccountId: 'salary',
    ...overrides,
  }
}

function household(overrides: Partial<PeriodFacts> = {}): PeriodFacts {
  return {
    today: '2026-10-15',
    period: { label: '2026-10', start: '2026-10-01', end: '2026-10-31' },
    recentPeriods: [],
    upcomingPeriods: [
      { label: '2026-11', start: '2026-11-01', end: '2026-11-30' },
      { label: '2026-12', start: '2026-12-01', end: '2026-12-31' },
    ],
    installmentBudgetView: 'per_installment',
    budgetBase: 'fixed_income',
    accounts: [
      { id: 'checking', parentId: null, kind: 'checking', class: 'asset', incomeNature: null },
      {
        id: 'salary',
        parentId: null,
        kind: 'income_category',
        class: 'income',
        incomeNature: 'fixed',
      },
      {
        id: 'housing',
        parentId: null,
        kind: 'expense_category',
        class: 'expense',
        incomeNature: null,
      },
    ],
    postings: [
      {
        accountId: 'salary',
        amountCents: -400_000,
        effectiveOn: '2026-10-05',
        occurredOn: '2026-10-05',
      },
    ],
    occurrences: [
      occurrence({ dueOn: '2026-11-05' }),
      occurrence({ dueOn: '2026-12-05' }),
      occurrence({
        dueOn: '2026-11-10',
        amountCents: 200_000,
        entryType: 'expense',
        categoryAccountId: 'housing',
      }),
    ],
    budgets: [],
    reserve: null,
    cards: [CARD],
    invoices: [],
    allocation: null,
    balances: [{ accountId: 'checking', balanceCents: 300_000 }],
    ...overrides,
  }
}

const TV_IN_THREE = {
  amountCents: 300_000,
  installmentCount: 3,
  occurredOn: '2026-10-15',
  card: CARD,
  paidFromAccountId: null,
}

describe('simulatePurchase', () => {
  it('shows an installment purchase landing on the coming months, not on this one', () => {
    const impact = simulatePurchase(household(), TV_IN_THREE)
    expect(impact.period).toEqual({
      label: '2026-10',
      freeToSpendBefore: 400_000,
      freeToSpendAfter: 400_000,
      dailyAllowanceBefore: Math.floor(400_000 / 17),
      dailyAllowanceAfter: Math.floor(400_000 / 17),
    })
    expect(impact.coming).toEqual([
      {
        label: '2026-11',
        committedBefore: 200_000,
        committedAfter: 300_000,
        percentOfIncomeBefore: 50,
        percentOfIncomeAfter: 75,
      },
      {
        label: '2026-12',
        committedBefore: 0,
        committedAfter: 100_000,
        percentOfIncomeBefore: 0,
        percentOfIncomeAfter: 25,
      },
    ])
    expect(impact.newInsights).toEqual([
      {
        code: 'period_heavily_committed',
        severity: 'warning',
        subject: '2026-11',
        values: { percentOfIncome: 75, committedCents: 300_000 },
      },
    ])
  })

  it('counts the whole purchase now when the household budgets by purchase month', () => {
    const impact = simulatePurchase(
      household({ installmentBudgetView: 'purchase_month' }),
      TV_IN_THREE,
    )
    expect(impact.period.freeToSpendAfter).toBe(100_000)
  })

  it('takes a debit purchase from the account today, warning when it would go negative', () => {
    const impact = simulatePurchase(household(), {
      amountCents: 350_000,
      installmentCount: 1,
      occurredOn: '2026-10-15',
      card: null,
      paidFromAccountId: 'checking',
    })
    expect(impact.period.freeToSpendAfter).toBe(50_000)
    expect(impact.newInsights).toContainEqual({
      code: 'balance_going_negative',
      severity: 'alert',
      subject: 'checking',
      values: { lowestCents: -50_000, lowestOn: '2026-10-15' },
    })
  })

  it('moves a later debit purchase on its own date', () => {
    const impact = simulatePurchase(household(), {
      amountCents: 350_000,
      installmentCount: 1,
      occurredOn: '2026-10-20',
      card: null,
      paidFromAccountId: 'checking',
    })
    expect(impact.newInsights).toContainEqual(
      expect.objectContaining({
        code: 'balance_going_negative',
        values: { lowestCents: -50_000, lowestOn: '2026-10-20' },
      }),
    )
  })

  it('reports only the alerts the purchase would bring, not the ones already there', () => {
    const base = household()
    const withOverdueBill = household({
      occurrences: [
        ...base.occurrences,
        occurrence({
          dueOn: '2026-10-10',
          amountCents: 1_000,
          entryType: 'expense',
          categoryAccountId: 'housing',
        }),
      ],
    })
    const codes = simulatePurchase(withOverdueBill, TV_IN_THREE).newInsights.map(
      (insight) => insight.code,
    )
    expect(codes).toEqual(['period_heavily_committed'])
  })

  it('adds to an invoice that already has purchases', () => {
    const withInvoice = household({
      invoices: [
        {
          cardAccountId: 'card',
          closingOn: '2026-11-03',
          dueOn: '2026-11-10',
          totalCents: 50_000,
          paidCents: 0,
        },
      ],
      today: '2026-10-15',
    })
    const impact = simulatePurchase(withInvoice, {
      ...TV_IN_THREE,
      installmentCount: 1,
      amountCents: 60_000,
    })
    expect(impact.coming[0]?.committedAfter).toBe(260_000)
    expect(withPurchase(withInvoice, TV_IN_THREE).invoices).toEqual([
      {
        cardAccountId: 'card',
        closingOn: '2026-11-03',
        dueOn: '2026-11-10',
        totalCents: 150_000,
        paidCents: 0,
      },
      {
        cardAccountId: 'card',
        closingOn: '2026-12-03',
        dueOn: '2026-12-10',
        totalCents: 100_000,
        paidCents: 0,
      },
      {
        cardAccountId: 'card',
        closingOn: '2027-01-03',
        dueOn: '2027-01-10',
        totalCents: 100_000,
        paidCents: 0,
      },
    ])
  })
})

describe('purchaseSimulationQuerySchema', () => {
  const ID = '01900000-0000-7000-8000-000000000001'

  it('needs either a card or an account, and installments only on a card', () => {
    expect(
      purchaseSimulationQuerySchema.safeParse({ amountCents: '100', cardAccountId: ID }).success,
    ).toBe(true)
    expect(purchaseSimulationQuerySchema.safeParse({ amountCents: '100' }).success).toBe(false)
    expect(
      purchaseSimulationQuerySchema.safeParse({
        amountCents: '100',
        cardAccountId: ID,
        paidFromAccountId: ID,
      }).success,
    ).toBe(false)
    expect(
      purchaseSimulationQuerySchema.safeParse({
        amountCents: '100',
        paidFromAccountId: ID,
        installmentCount: '2',
      }).success,
    ).toBe(false)
  })
})
