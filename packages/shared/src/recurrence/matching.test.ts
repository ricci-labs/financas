import { entryFitsOccurrence, suggestedOccurrences } from '@shared/recurrence/matching'
import type { MatchableEntry, MatchableOccurrence } from '@shared/recurrence/recurrence.types'
import { describe, expect, it } from 'vitest'

function occurrence(overrides: Partial<MatchableOccurrence> = {}): MatchableOccurrence {
  return {
    dueOn: '2026-10-10',
    amountCents: 200_000,
    amountIsEstimate: false,
    entryType: 'expense',
    sourceAccountId: 'checking',
    categoryAccountId: 'housing',
    frequency: 'monthly',
    interval: 1,
    ...overrides,
  }
}

function paid(
  amountCents: number,
  occurredOn = '2026-10-10',
  category = 'housing',
): MatchableEntry {
  return {
    entryType: 'expense',
    occurredOn,
    postings: [
      { accountId: category, amountCents },
      { accountId: 'checking', amountCents: -amountCents },
    ],
  }
}

describe('entryFitsOccurrence', () => {
  it('needs the same kind of entry touching both accounts of the rule', () => {
    expect(entryFitsOccurrence(paid(1), occurrence())).toBe(true)
    expect(entryFitsOccurrence(paid(1, '2026-10-10', 'groceries'), occurrence())).toBe(false)
    expect(entryFitsOccurrence({ ...paid(1), entryType: 'transfer' }, occurrence())).toBe(false)
    const fromSavings: MatchableEntry = {
      ...paid(1),
      postings: [
        { accountId: 'housing', amountCents: 1 },
        { accountId: 'savings', amountCents: -1 },
      ],
    }
    expect(entryFitsOccurrence(fromSavings, occurrence())).toBe(false)
  })
})

describe('suggestedOccurrences', () => {
  it('suggests within 5% of a fixed amount and 20% of an estimate', () => {
    expect(suggestedOccurrences(paid(210_000), [occurrence()])).toHaveLength(1)
    expect(suggestedOccurrences(paid(210_001), [occurrence()])).toHaveLength(0)
    const energy = occurrence({ amountCents: 30_000, amountIsEstimate: true })
    expect(suggestedOccurrences(paid(36_000), [energy])).toHaveLength(1)
    expect(suggestedOccurrences(paid(36_001), [energy])).toHaveLength(0)
  })

  it('suggests within ten days of the due date, less for a weekly rule', () => {
    expect(suggestedOccurrences(paid(200_000, '2026-10-20'), [occurrence()])).toHaveLength(1)
    expect(suggestedOccurrences(paid(200_000, '2026-09-29'), [occurrence()])).toHaveLength(0)
    const weekly = occurrence({ frequency: 'weekly' })
    expect(suggestedOccurrences(paid(200_000, '2026-10-13'), [weekly])).toHaveLength(1)
    expect(suggestedOccurrences(paid(200_000, '2026-10-14'), [weekly])).toHaveLength(0)
  })

  it('puts the closest due date first, then the closest amount', () => {
    const september = occurrence({ dueOn: '2026-10-02' })
    const october = occurrence({ dueOn: '2026-10-10' })
    const sameDayOther = occurrence({ dueOn: '2026-10-10', amountCents: 205_000 })
    expect(
      suggestedOccurrences(paid(205_000, '2026-10-09'), [september, october, sameDayOther]),
    ).toEqual([sameDayOther, october, september])
  })

  it('reads an income by the amount credited to its category', () => {
    const salary = occurrence({
      entryType: 'income',
      categoryAccountId: 'salary',
      amountCents: 500_000,
    })
    const received: MatchableEntry = {
      entryType: 'income',
      occurredOn: '2026-10-07',
      postings: [
        { accountId: 'checking', amountCents: 500_000 },
        { accountId: 'salary', amountCents: -500_000 },
      ],
    }
    expect(suggestedOccurrences(received, [salary])).toEqual([salary])
  })
})
