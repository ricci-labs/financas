import { computeMetrics } from '@shared/metrics/metrics'
import type { FactPosting, PeriodFacts } from '@shared/metrics/metrics.types'
import { describe, expect, it } from 'vitest'

const OCTOBER = { label: '2026-10', start: '2026-10-01', end: '2026-10-31' }

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
    installmentBudgetView: 'per_installment',
    budgetBase: 'fixed_income',
    accounts: [
      { id: 'checking', kind: 'checking', class: 'asset', incomeNature: null },
      { id: 'salary-a', kind: 'income_category', class: 'income', incomeNature: 'fixed' },
      { id: 'salary-b', kind: 'income_category', class: 'income', incomeNature: 'fixed' },
      { id: 'commission', kind: 'income_category', class: 'income', incomeNature: 'variable' },
      { id: 'groceries', kind: 'expense_category', class: 'expense', incomeNature: null },
      { id: 'housing', kind: 'expense_category', class: 'expense', incomeNature: null },
      { id: 'electronics', kind: 'expense_category', class: 'expense', incomeNature: null },
      { id: 'card', kind: 'credit_card', class: 'liability', incomeNature: null },
    ],
    postings: [
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
        dueOn: '2026-10-20',
        amountCents: 400_000,
        entryType: 'income',
        status: 'pending',
        categoryAccountId: 'salary-b',
      },
      {
        dueOn: '2026-10-30',
        amountCents: 100_000,
        entryType: 'income',
        status: 'pending',
        categoryAccountId: 'commission',
      },
      {
        dueOn: '2026-10-13',
        amountCents: 200_000,
        entryType: 'expense',
        status: 'pending',
        categoryAccountId: 'housing',
      },
      {
        dueOn: '2026-10-25',
        amountCents: 4_000,
        entryType: 'card_purchase',
        status: 'pending',
        categoryAccountId: 'electronics',
      },
      {
        dueOn: '2026-10-08',
        amountCents: 15_000,
        entryType: 'expense',
        status: 'matched',
        categoryAccountId: 'housing',
      },
      {
        dueOn: '2026-10-09',
        amountCents: 9_000,
        entryType: 'expense',
        status: 'skipped',
        categoryAccountId: 'housing',
      },
      {
        dueOn: '2026-11-10',
        amountCents: 200_000,
        entryType: 'expense',
        status: 'pending',
        categoryAccountId: 'housing',
      },
    ],
    ...overrides,
  }
}

describe('computeMetrics', () => {
  it('answers how much is still free to spend, per installment', () => {
    expect(computeMetrics(household())).toEqual({
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
