import { computeMetrics } from '@shared/metrics/metrics'
import type { FactPosting, PeriodFacts } from '@shared/metrics/metrics.types'
import { describe, expect, it } from 'vitest'

const OCTOBER = { label: '2026-10', start: '2026-10-01', end: '2026-10-31' }
const RECENT = ['04', '05', '06', '07', '08', '09'].map((month) => ({
  label: `2026-${month}`,
  start: `2026-${month}-01`,
  end: `2026-${month}-${month === '04' || month === '06' || month === '09' ? '30' : '31'}`,
}))

function moved(
  accountId: string,
  amountCents: number,
  effectiveOn: string,
  occurredOn = effectiveOn,
): FactPosting {
  return { accountId, amountCents, effectiveOn, occurredOn }
}

function household(overrides: Partial<PeriodFacts> = {}): PeriodFacts {
  return {
    today: '2026-10-15',
    period: OCTOBER,
    recentPeriods: RECENT,
    upcomingPeriods: [
      { label: '2026-11', start: '2026-11-01', end: '2026-11-30' },
      { label: '2026-12', start: '2026-12-01', end: '2026-12-31' },
    ],
    installmentBudgetView: 'per_installment',
    budgetBase: 'fixed_income',
    accounts: [
      { id: 'checking', parentId: null, kind: 'checking', class: 'asset', incomeNature: null },
      {
        id: 'salary-a',
        parentId: null,
        kind: 'income_category',
        class: 'income',
        incomeNature: 'fixed',
      },
      {
        id: 'salary-b',
        parentId: null,
        kind: 'income_category',
        class: 'income',
        incomeNature: 'fixed',
      },
      {
        id: 'commission',
        parentId: null,
        kind: 'income_category',
        class: 'income',
        incomeNature: 'variable',
      },
      {
        id: 'food',
        parentId: null,
        kind: 'expense_category',
        class: 'expense',
        incomeNature: null,
      },
      {
        id: 'groceries',
        parentId: 'food',
        kind: 'expense_category',
        class: 'expense',
        incomeNature: null,
      },
      {
        id: 'housing',
        parentId: null,
        kind: 'expense_category',
        class: 'expense',
        incomeNature: null,
      },
      {
        id: 'electronics',
        parentId: null,
        kind: 'expense_category',
        class: 'expense',
        incomeNature: null,
      },
      { id: 'card', parentId: null, kind: 'credit_card', class: 'liability', incomeNature: null },
    ],
    postings: [
      moved('commission', -100_000, '2026-08-05'),
      moved('checking', 100_000, '2026-08-05'),
      moved('groceries', 40_000, '2026-08-10'),
      moved('checking', -40_000, '2026-08-10'),
      moved('checking', 500_000, '2026-10-05'),
      moved('salary-a', -500_000, '2026-10-05'),
      moved('checking', 120_000, '2026-10-10'),
      moved('commission', -120_000, '2026-10-10'),
      moved('groceries', 30_000, '2026-10-12'),
      moved('checking', -30_000, '2026-10-12'),
      moved('electronics', 30_000, '2026-09-20', '2026-09-20'),
      moved('electronics', 30_000, '2026-10-20', '2026-09-20'),
      moved('electronics', 30_000, '2026-11-20', '2026-09-20'),
      moved('card', -90_000, '2026-09-20', '2026-09-20'),
    ],
    occurrences: [
      {
        id: 'occurrence-1',
        sourceAccountId: 'checking',
        dueOn: '2026-10-20',
        amountCents: 400_000,
        entryType: 'income',
        status: 'pending',
        categoryAccountId: 'salary-b',
      },
      {
        id: 'occurrence-2',
        sourceAccountId: 'checking',
        dueOn: '2026-10-30',
        amountCents: 100_000,
        entryType: 'income',
        status: 'pending',
        categoryAccountId: 'commission',
      },
      {
        id: 'occurrence-3',
        sourceAccountId: 'checking',
        dueOn: '2026-10-13',
        amountCents: 200_000,
        entryType: 'expense',
        status: 'pending',
        categoryAccountId: 'housing',
      },
      {
        id: 'occurrence-4',
        sourceAccountId: 'card',
        dueOn: '2026-10-25',
        amountCents: 4_000,
        entryType: 'card_purchase',
        status: 'pending',
        categoryAccountId: 'electronics',
      },
      {
        id: 'occurrence-5',
        sourceAccountId: 'checking',
        dueOn: '2026-10-08',
        amountCents: 15_000,
        entryType: 'expense',
        status: 'matched',
        categoryAccountId: 'housing',
      },
      {
        id: 'occurrence-6',
        sourceAccountId: 'checking',
        dueOn: '2026-10-09',
        amountCents: 9_000,
        entryType: 'expense',
        status: 'skipped',
        categoryAccountId: 'housing',
      },
      {
        id: 'occurrence-7',
        sourceAccountId: 'checking',
        dueOn: '2026-11-10',
        amountCents: 200_000,
        entryType: 'expense',
        status: 'pending',
        categoryAccountId: 'housing',
      },
      {
        id: 'occurrence-8',
        sourceAccountId: 'checking',
        dueOn: '2026-11-20',
        amountCents: 400_000,
        entryType: 'income',
        status: 'pending',
        categoryAccountId: 'salary-b',
      },
    ],
    reserve: { targetCents: 3_000_000, savedCents: 1_200_000 },
    cards: [{ accountId: 'card', closingDay: 3, dueDay: 10, purchaseOnClosingDayGoesNext: true }],
    invoices: [
      { cardAccountId: 'card', closingOn: '2026-10-03', totalCents: 30_000 },
      { cardAccountId: 'card', closingOn: '2026-11-03', totalCents: 45_000 },
    ],
    budgets: [
      { categoryAccountId: 'food', limitCents: 20_000 },
      { categoryAccountId: 'housing', limitCents: 250_000 },
      { categoryAccountId: 'electronics', limitCents: 40_000 },
    ],
    ...overrides,
  }
}

describe('computeMetrics', () => {
  it('answers how much is still free to spend, per installment', () => {
    expect(computeMetrics(household())).toMatchObject({
      fixedIncome: 900_000,
      variableIncome: 120_000,
      budgetIncome: 900_000,
      spent: 60_000,
      committed: 204_000,
      freeToSpend: 636_000,
      dailyAllowance: 37_411,
    })
  })

  it('counts an installment purchase in the month it was bought, when the household prefers', () => {
    const metrics = computeMetrics(household({ installmentBudgetView: 'purchase_month' }))
    expect([metrics.spent, metrics.freeToSpend]).toEqual([30_000, 666_000])
  })

  it('adds the commission to the budget only when the budget is built on all income', () => {
    expect(computeMetrics(household({ budgetBase: 'all_income' })).budgetIncome).toBe(1_020_000)
  })

  it('spreads what is free over the whole period before it starts, and gives nothing after it', () => {
    expect(computeMetrics(household({ today: '2026-09-20' })).dailyAllowance).toBe(
      Math.floor(636_000 / 31),
    )
    expect(computeMetrics(household({ today: '2026-10-31' })).dailyAllowance).toBe(636_000)
    expect(computeMetrics(household({ today: '2026-11-01' })).dailyAllowance).toBeNull()
  })

  it('never gives a negative allowance when the period is already over budget', () => {
    const overspent = household({
      postings: [...household().postings, moved('groceries', 1_000_000, '2026-10-14')],
    })
    expect(computeMetrics(overspent).freeToSpend).toBe(-364_000)
    expect(computeMetrics(overspent).dailyAllowance).toBe(0)
  })
})

describe('budgetPace', () => {
  it('compares what each budget spent with the share of the period gone, a parent covering its children', () => {
    expect(computeMetrics(household()).budgetPace).toEqual([
      {
        categoryAccountId: 'food',
        limitCents: 20_000,
        spentCents: 30_000,
        expectedCents: 9_677,
        status: 'over',
      },
      {
        categoryAccountId: 'housing',
        limitCents: 250_000,
        spentCents: 0,
        expectedCents: 120_968,
        status: 'within',
      },
      {
        categoryAccountId: 'electronics',
        limitCents: 40_000,
        spentCents: 30_000,
        expectedCents: 19_355,
        status: 'ahead',
      },
    ])
  })

  it('covers every level below the budgeted category', () => {
    const base = household()
    const withGrandchild = household({
      accounts: [
        {
          id: 'snacks',
          parentId: 'groceries',
          kind: 'expense_category',
          class: 'expense',
          incomeNature: null,
        },
        ...base.accounts,
      ],
      postings: [...base.postings, moved('snacks', 5_000, '2026-10-03')],
      budgets: [{ categoryAccountId: 'food', limitCents: 20_000 }],
    })
    expect(computeMetrics(withGrandchild).budgetPace[0]?.spentCents).toBe(35_000)
  })

  it('expects nothing before the period and the whole limit after it', () => {
    const expected = (today: string) =>
      computeMetrics(household({ today })).budgetPace.map((line) => line.expectedCents)
    expect(expected('2026-09-30')).toEqual([0, 0, 0])
    expect(expected('2026-11-01')).toEqual([20_000, 250_000, 40_000])
  })
})

describe('variableAverage', () => {
  it('averages the commission over the recent periods the household already used', () => {
    expect(computeMetrics(household()).variableAverage).toBe(50_000)
  })

  it('has nothing to average before any history', () => {
    expect(computeMetrics(household({ recentPeriods: [] })).variableAverage).toBeNull()
  })
})

describe('reserveCoverage', () => {
  it('says how many months of recent spending the reserve covers', () => {
    expect(computeMetrics(household()).reserveCoverage).toEqual({
      savedCents: 1_200_000,
      targetCents: 3_000_000,
      monthlySpendingCents: 35_000,
      months: 34.3,
    })
  })

  it('averages the last three periods, leaving out the ones with no activity', () => {
    const busy = household()
    const olderSpending = household({
      postings: [...busy.postings, moved('groceries', 900_000, '2026-04-10')],
    })
    expect(computeMetrics(olderSpending).reserveCoverage?.monthlySpendingCents).toBe(35_000)
    const recentSpending = household({
      postings: [...busy.postings, moved('groceries', 900_000, '2026-07-10')],
    })
    expect(computeMetrics(recentSpending).reserveCoverage?.monthlySpendingCents).toBe(
      Math.round((900_000 + 40_000 + 30_000) / 3),
    )
  })

  it('has no months without spending history, and nothing without a reserve', () => {
    expect(computeMetrics(household({ recentPeriods: [] })).reserveCoverage?.months).toBeNull()
    expect(computeMetrics(household({ reserve: null })).reserveCoverage).toBeNull()
  })
})

describe('committedAhead', () => {
  it('shows how much of each coming period installments and bills already take', () => {
    expect(computeMetrics(household()).committedAhead).toEqual([
      {
        label: '2026-11',
        installmentsCents: 30_000,
        plannedCents: 200_000,
        committedCents: 230_000,
        fixedIncomeCents: 400_000,
        percentOfIncome: 58,
      },
      {
        label: '2026-12',
        installmentsCents: 0,
        plannedCents: 0,
        committedCents: 0,
        fixedIncomeCents: 0,
        percentOfIncome: null,
      },
    ])
  })

  it('keeps counting installments by their month even when the budget counts purchases', () => {
    const byPurchase = computeMetrics(household({ installmentBudgetView: 'purchase_month' }))
    expect(byPurchase.committedAhead[0]?.installmentsCents).toBe(30_000)
  })
})

describe('nextInvoice', () => {
  it('forecasts the open invoice: what is on it plus the subscriptions before it closes', () => {
    expect(computeMetrics(household()).nextInvoice).toEqual([
      {
        cardAccountId: 'card',
        closingOn: '2026-11-03',
        dueOn: '2026-11-10',
        postedCents: 45_000,
        plannedCents: 4_000,
        forecastCents: 49_000,
      },
    ])
  })

  it('leaves out subscriptions of the next cycle, of other cards and skipped ones', () => {
    const base = household()
    const busier = household({
      occurrences: [
        ...base.occurrences,
        {
          id: 'extra-1',
          sourceAccountId: 'card',
          dueOn: '2026-11-05',
          amountCents: 7_000,
          entryType: 'card_purchase',
          status: 'pending',
          categoryAccountId: 'electronics',
        },
        {
          id: 'extra-2',
          sourceAccountId: 'card',
          dueOn: '2026-10-27',
          amountCents: 6_000,
          entryType: 'card_purchase',
          status: 'skipped',
          categoryAccountId: 'electronics',
        },
        {
          id: 'extra-3',
          sourceAccountId: 'other-card',
          dueOn: '2026-10-26',
          amountCents: 5_000,
          entryType: 'card_purchase',
          status: 'pending',
          categoryAccountId: 'electronics',
        },
      ],
    })
    expect(computeMetrics(busier).nextInvoice[0]?.plannedCents).toBe(4_000)
  })

  it('starts empty for a card with nothing on its open invoice yet', () => {
    const forecast = computeMetrics(household({ invoices: [], occurrences: [] })).nextInvoice
    expect(forecast[0]).toMatchObject({ postedCents: 0, plannedCents: 0, forecastCents: 0 })
  })
})
