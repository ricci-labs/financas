import type { AllocationStepInput } from '@shared/planning/allocation/allocation.schemas'
import type {
  AllocationContext,
  AllocationPart,
  AllocationSplit,
  AllocationStep,
} from '@shared/planning/allocation/allocation.types'

const PERCENT = 100

const NO_DETAILS = { goalId: null, accountId: null, percent: null, amountCents: null }

export function allocationStepOf(input: AllocationStepInput): AllocationStep {
  return { ...NO_DETAILS, ...input }
}

export function splitVariableIncome(
  amountCents: number,
  steps: readonly AllocationStep[],
  context: AllocationContext,
): AllocationSplit {
  const parts: AllocationPart[] = []
  let leftoverCents = amountCents
  for (const [index, step] of steps.entries()) {
    const wanted = Math.min(wantedBy(step, amountCents, leftoverCents, context), leftoverCents)
    if (wanted > 0) {
      parts.push({
        position: index + 1,
        kind: step.kind,
        toAccountId: destinationOf(step, context),
        amountCents: wanted,
      })
      leftoverCents -= wanted
    }
  }
  return { parts, leftoverCents }
}

function wantedBy(
  step: AllocationStep,
  amountCents: number,
  leftoverCents: number,
  context: AllocationContext,
): number {
  switch (step.kind) {
    case 'fill_goal': {
      const goal = context.goals.find((candidate) => candidate.goalId === step.goalId)
      return goal ? goal.targetCents - goal.savedCents : 0
    }
    case 'cover_overspent':
      return context.overspentCents
    case 'percent':
      return Math.floor((amountCents * (step.percent ?? 0)) / PERCENT)
    case 'fixed_amount':
      return step.amountCents ?? 0
    case 'rest':
      return leftoverCents
  }
}

function destinationOf(step: AllocationStep, context: AllocationContext): string | null {
  if (step.kind === 'fill_goal') {
    return context.goals.find((goal) => goal.goalId === step.goalId)?.accountId ?? null
  }
  return step.accountId
}
