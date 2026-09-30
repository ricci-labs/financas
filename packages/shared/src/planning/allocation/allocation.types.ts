import type { AllocationStepKind } from '@shared/planning/allocation/allocation.constants'

export type AllocationStep = {
  kind: AllocationStepKind
  goalId: string | null
  accountId: string | null
  percent: number | null
  amountCents: number | null
}

export type AllocationGoal = {
  goalId: string
  accountId: string
  targetCents: number
  savedCents: number
}

export type AllocationContext = {
  goals: readonly AllocationGoal[]
  overspentCents: number
}

export type AllocationPart = {
  position: number
  kind: AllocationStepKind
  toAccountId: string | null
  amountCents: number
}

export type AllocationSplit = {
  parts: AllocationPart[]
  leftoverCents: number
}
