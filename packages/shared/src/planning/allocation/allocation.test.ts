import { splitVariableIncome } from '@shared/planning/allocation/allocation'
import { allocationStepsSchema } from '@shared/planning/allocation/allocation.schemas'
import type {
  AllocationContext,
  AllocationStep,
} from '@shared/planning/allocation/allocation.types'
import { describe, expect, it } from 'vitest'

function step(overrides: Partial<AllocationStep> & Pick<AllocationStep, 'kind'>): AllocationStep {
  return { goalId: null, accountId: null, percent: null, amountCents: null, ...overrides }
}

const HOUSEHOLD_POLICY: AllocationStep[] = [
  step({ kind: 'fill_goal', goalId: 'reserve' }),
  step({ kind: 'cover_overspent' }),
  step({ kind: 'percent', accountId: 'trip', percent: 50 }),
  step({ kind: 'rest', accountId: 'fun' }),
]

const CONTEXT: AllocationContext = {
  goals: [
    {
      goalId: 'reserve',
      accountId: 'reserve-account',
      targetCents: 3_000_000,
      savedCents: 2_950_000,
    },
  ],
  overspentCents: 20_000,
}

describe('splitVariableIncome', () => {
  it('follows the waterfall: top up the reserve, cover the overrun, then goals and fun', () => {
    expect(splitVariableIncome(200_000, HOUSEHOLD_POLICY, CONTEXT)).toEqual({
      parts: [
        { position: 1, kind: 'fill_goal', toAccountId: 'reserve-account', amountCents: 50_000 },
        { position: 2, kind: 'cover_overspent', toAccountId: null, amountCents: 20_000 },
        { position: 3, kind: 'percent', toAccountId: 'trip', amountCents: 100_000 },
        { position: 4, kind: 'rest', toAccountId: 'fun', amountCents: 30_000 },
      ],
      leftoverCents: 0,
    })
  })

  it('stops when the money runs out, and skips steps with nothing to do', () => {
    const full = { ...CONTEXT, goals: [{ ...CONTEXT.goals[0], savedCents: 3_100_000 }] }
    expect(splitVariableIncome(30_000, HOUSEHOLD_POLICY, full as AllocationContext)).toEqual({
      parts: [
        { position: 2, kind: 'cover_overspent', toAccountId: null, amountCents: 20_000 },
        { position: 3, kind: 'percent', toAccountId: 'trip', amountCents: 10_000 },
      ],
      leftoverCents: 0,
    })
  })

  it('leaves what no step takes, and moves fixed amounts', () => {
    const steps = [step({ kind: 'fixed_amount', accountId: 'car', amountCents: 40_000 })]
    expect(splitVariableIncome(100_000, steps, CONTEXT)).toEqual({
      parts: [{ position: 1, kind: 'fixed_amount', toAccountId: 'car', amountCents: 40_000 }],
      leftoverCents: 60_000,
    })
  })
})

describe('allocationStepsSchema', () => {
  it('takes the rest only as the last step', () => {
    const rest = { kind: 'rest', accountId: '01900000-0000-7000-8000-000000000001' }
    const cover = { kind: 'cover_overspent' }
    expect(allocationStepsSchema.safeParse({ steps: [cover, rest] }).success).toBe(true)
    expect(allocationStepsSchema.safeParse({ steps: [rest, cover] }).success).toBe(false)
  })
})
