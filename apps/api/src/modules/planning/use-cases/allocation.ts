import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { parseOrThrow, ValidationError } from '@api/core/http/errors'
import { loadUsableAccounts } from '@api/modules/ledger'
import {
  insertAllocationSteps,
  markAllocationStepsDeleted,
  selectActiveGoals,
  selectAllocationSteps,
} from '@api/modules/planning/planning.repository'
import type { AllocationStepItem, PlanningContext } from '@api/modules/planning/planning.types'
import {
  type AccountKind,
  type AllocationStepInput,
  allocationStepOf,
  allocationStepsSchema,
  MONEY_ACCOUNT_KINDS,
} from '@financas/shared'

const MONEY_KINDS: ReadonlySet<AccountKind> = new Set(MONEY_ACCOUNT_KINDS)

export function listAllocationSteps(
  db: Database,
  workspaceId: string,
): Promise<AllocationStepItem[]> {
  return withWorkspace(db, workspaceId, (tx) => selectAllocationSteps(tx))
}

export function readAllocationSteps(tx: WorkspaceTransaction): Promise<AllocationStepItem[]> {
  return selectAllocationSteps(tx)
}

export async function replaceAllocationSteps(
  db: Database,
  { workspaceId, userId }: PlanningContext,
  rawInput: unknown,
  clock: Clock = systemClock,
): Promise<void> {
  const { steps } = parseOrThrow(allocationStepsSchema, rawInput, 'ALLOCATION_INVALID')
  await withWorkspace(db, workspaceId, async (tx) => {
    await assertDestinationsExist(tx, steps)
    await markAllocationStepsDeleted(tx, { deletedAt: clock.now(), deletedByUserId: userId })
    if (steps.length === 0) {
      return
    }
    await insertAllocationSteps(
      tx,
      steps.map((step, index) => ({ workspaceId, position: index + 1, ...allocationStepOf(step) })),
    )
  })
}

async function assertDestinationsExist(
  tx: WorkspaceTransaction,
  steps: AllocationStepInput[],
): Promise<void> {
  const accountIds = steps.flatMap((step) => ('accountId' in step ? [step.accountId] : []))
  const accounts = await loadUsableAccounts(tx, accountIds)
  const everyAccountHoldsMoney = accountIds.every((accountId) => {
    const kind = accounts.get(accountId)?.kind
    return kind !== undefined && MONEY_KINDS.has(kind)
  })
  if (!everyAccountHoldsMoney) {
    throw new ValidationError('ALLOCATION_ACCOUNT_INVALID', 'Commission goes to money accounts')
  }
  const goalIds = new Set((await selectActiveGoals(tx)).map((goal) => goal.id))
  const everyGoalExists = steps.every((step) => !('goalId' in step) || goalIds.has(step.goalId))
  if (!everyGoalExists) {
    throw new ValidationError('ALLOCATION_GOAL_INVALID', 'A step fills a goal that does not exist')
  }
}
