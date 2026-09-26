import { computeInsights } from '@shared/insights/insights'
import { computeMetrics, type PeriodMetrics } from '@shared/metrics/metrics'
import type { PeriodFacts } from '@shared/metrics/metrics.types'
import { describe, expect, it } from 'vitest'

const FACTS: PeriodFacts = {
  today: '2026-10-15',
  period: { label: '2026-10', start: '2026-10-01', end: '2026-10-31' },
  recentPeriods: [],
  upcomingPeriods: [],
  installmentBudgetView: 'per_installment',
  budgetBase: 'fixed_income',
  accounts: [],
  postings: [],
  occurrences: [
    {
      id: 'rent-october',
      sourceAccountId: 'checking',
      dueOn: '2026-10-10',
      amountCents: 200_000,
      entryType: 'expense',
      status: 'pending',
      categoryAccountId: 'housing',
    },
    {
      id: 'energy-october',
      sourceAccountId: 'checking',
      dueOn: '2026-10-05',
      amountCents: 15_000,
      entryType: 'expense',
      status: 'matched',
      categoryAccountId: 'housing',
    },
    {
      id: 'rent-november',
      sourceAccountId: 'checking',
      dueOn: '2026-11-10',
      amountCents: 200_000,
      entryType: 'expense',
      status: 'pending',
      categoryAccountId: 'housing',
    },
  ],
  budgets: [],
  reserve: null,
  cards: [],
  invoices: [],
  allocation: null,
  balances: [],
  contactBalances: [],
}

function metricsWith(overrides: Partial<PeriodMetrics>): PeriodMetrics {
  return { ...computeMetrics(FACTS), freeToSpend: 0, ...overrides }
}

function codes(metrics: PeriodMetrics): string[] {
  return computeInsights(FACTS, metrics).map((insight) => `${insight.code} ${insight.subject}`)
}

describe('computeInsights', () => {
  it('lists alerts before warnings, each group in the order of INSIGHTS', () => {
    const insights = computeInsights(
      FACTS,
      metricsWith({
        freeToSpend: -5_000,
        budgetPace: [
          {
            categoryAccountId: 'food',
            limitCents: 100,
            spentCents: 50,
            expectedCents: 40,
            status: 'ahead',
          },
          {
            categoryAccountId: 'fun',
            limitCents: 100,
            spentCents: 120,
            expectedCents: 40,
            status: 'over',
          },
          {
            categoryAccountId: 'home',
            limitCents: 100,
            spentCents: 10,
            expectedCents: 40,
            status: 'within',
          },
        ],
      }),
    )
    expect(insights).toEqual([
      {
        code: 'period_overspent',
        severity: 'alert',
        subject: '2026-10',
        values: { overspentCents: 5_000 },
      },
      {
        code: 'budget_over',
        severity: 'alert',
        subject: 'fun',
        values: { limitCents: 100, spentCents: 120 },
      },
      {
        code: 'occurrence_overdue',
        severity: 'warning',
        subject: 'rent-october',
        values: { dueOn: '2026-10-10', amountCents: 200_000 },
      },
      {
        code: 'budget_ahead',
        severity: 'warning',
        subject: 'food',
        values: { limitCents: 100, spentCents: 50, expectedCents: 40 },
      },
    ])
  })

  it('points at bills still unpaid after their due date', () => {
    expect(codes(metricsWith({}))).toEqual(['occurrence_overdue rent-october'])
  })

  it('warns about a coming period with most of its income already committed', () => {
    const committedPeriod = (label: string, percentOfIncome: number | null) => ({
      label,
      installmentsCents: 0,
      plannedCents: 0,
      committedCents: 1_000,
      fixedIncomeCents: 1_000,
      percentOfIncome,
    })
    const metrics = metricsWith({
      committedAhead: [
        committedPeriod('2026-11', 69),
        committedPeriod('2026-12', 70),
        committedPeriod('2027-01', null),
      ],
    })
    expect(codes(metrics)).toEqual([
      'occurrence_overdue rent-october',
      'period_heavily_committed 2026-12',
    ])
  })

  it('stays quiet when all is well', () => {
    expect(
      computeInsights({ ...FACTS, occurrences: [] }, computeMetrics({ ...FACTS, occurrences: [] })),
    ).toEqual([])
  })
})

describe('variable_income_to_split', () => {
  const commission = (amountCents: number) => ({
    accountId: 'commission',
    amountCents: -amountCents,
    effectiveOn: '2026-10-10',
    occurredOn: '2026-10-10',
  })
  const moved = (accountId: string, amountCents: number, effectiveOn = '2026-10-12') => ({
    accountId,
    amountCents,
    effectiveOn,
    occurredOn: effectiveOn,
  })
  const facts = (postings: PeriodFacts['postings'], coversOverspent = false): PeriodFacts => ({
    ...FACTS,
    occurrences: [],
    accounts: [
      {
        id: 'commission',
        parentId: null,
        kind: 'income_category',
        class: 'income',
        incomeNature: 'variable',
      },
      { id: 'reserve', parentId: null, kind: 'savings', class: 'asset', incomeNature: null },
    ],
    postings,
    allocation: { destinationAccountIds: ['reserve'], coversOverspent },
  })
  const toSplit = (periodFacts: PeriodFacts, freeToSpend = 0) =>
    computeInsights(periodFacts, { ...computeMetrics(periodFacts), freeToSpend }).filter(
      (insight) => insight.code === 'variable_income_to_split',
    )

  it('reminds of the commission not yet moved to the waterfall destinations', () => {
    expect(toSplit(facts([commission(100_000), moved('reserve', 60_000)]))).toEqual([
      {
        code: 'variable_income_to_split',
        severity: 'info',
        subject: '2026-10',
        values: { amountCents: 40_000 },
      },
    ])
  })

  it('counts only money moved in this period, never withdrawals, and the overrun it covers', () => {
    const amountLeft = (periodFacts: PeriodFacts, freeToSpend = 0) =>
      toSplit(periodFacts, freeToSpend)[0]?.values.amountCents
    expect(amountLeft(facts([commission(100_000), moved('reserve', 60_000, '2026-09-30')]))).toBe(
      100_000,
    )
    expect(
      amountLeft(facts([commission(100_000), moved('reserve', 60_000), moved('reserve', -20_000)])),
    ).toBe(40_000)
    expect(toSplit(facts([commission(100_000), moved('reserve', 60_000)], true), -40_000)).toEqual(
      [],
    )
    expect(toSplit(facts([commission(100_000), moved('reserve', 60_000)]), -40_000)).toHaveLength(1)
  })

  it('says nothing once all is moved, without commission, or without a waterfall', () => {
    expect(toSplit(facts([commission(100_000), moved('reserve', 100_000)]))).toEqual([])
    expect(toSplit(facts([moved('reserve', 5_000)]))).toEqual([])
    expect(toSplit({ ...facts([commission(100_000)]), allocation: null })).toEqual([])
  })
})

describe('balance_going_negative', () => {
  it('alerts for each account whose forecast dips below zero', () => {
    const forecast = (accountId: string, lowestCents: number) => ({
      accountId,
      until: '2026-10-31',
      startCents: 10_000,
      endCents: 10_000,
      lowestCents,
      lowestOn: '2026-10-20',
      points: [],
    })
    const metrics = metricsWith({
      balanceForecast: [forecast('checking', -1), forecast('savings', 0)],
    })
    expect(computeInsights(FACTS, metrics)[0]).toEqual({
      code: 'balance_going_negative',
      severity: 'alert',
      subject: 'checking',
      values: { lowestCents: -1, lowestOn: '2026-10-20' },
    })
    expect(codes(metrics).filter((code) => code.startsWith('balance'))).toEqual([
      'balance_going_negative checking',
    ])
  })
})

describe('contact_overdue', () => {
  it('warns about each contact with something overdue', () => {
    const facts: PeriodFacts = {
      ...FACTS,
      occurrences: [],
      contactBalances: [
        {
          contactId: 'j',
          owedCents: 30_000,
          overdueCents: 10_000,
          nextDueOn: null,
          nextDueCents: 0,
        },
        {
          contactId: 'm',
          owedCents: 5_000,
          overdueCents: 0,
          nextDueOn: '2026-11-10',
          nextDueCents: 5_000,
        },
      ],
    }
    expect(computeInsights(facts, computeMetrics(facts))).toEqual([
      {
        code: 'contact_overdue',
        severity: 'warning',
        subject: 'j',
        values: { overdueCents: 10_000, owedCents: 30_000 },
      },
    ])
  })
})
