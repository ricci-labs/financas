import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import {
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import { loadUsableAccounts, readAccountBalances } from '@api/modules/ledger'
import {
  insertGoal,
  lockActiveGoal,
  selectActiveGoals,
  updateGoal,
} from '@api/modules/planning/planning.repository'
import type {
  CreatedGoal,
  DeleteGoalInput,
  GoalItem,
  GoalRef,
  GoalRow,
  PlanningContext,
} from '@api/modules/planning/planning.types'
import {
  type AccountKind,
  goalChangeSchema,
  MONEY_ACCOUNT_KINDS,
  newGoalSchema,
} from '@financas/shared'

const GOAL_INVALID = 'GOAL_INVALID'
const MONEY_KINDS: ReadonlySet<AccountKind> = new Set(MONEY_ACCOUNT_KINDS)
const CONFLICT_OF_CONSTRAINT: Record<string, [string, string]> = {
  goals_one_per_account: ['GOAL_ACCOUNT_TAKEN', 'Another goal already uses this account'],
  goals_one_reserve: ['RESERVE_ALREADY_SET', 'The workspace already has a reserve'],
}

export function listGoals(db: Database, workspaceId: string): Promise<GoalItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const balances = new Map(
      (await readAccountBalances(tx)).map((balance) => [
        balance.accountId,
        balance.naturalBalanceCents,
      ]),
    )
    return (await selectActiveGoals(tx)).map((goal) =>
      itemOf(goal, balances.get(goal.accountId) ?? 0),
    )
  })
}

export async function createGoal(
  db: Database,
  { workspaceId }: PlanningContext,
  rawInput: unknown,
): Promise<CreatedGoal> {
  const goal = parseOrThrow(newGoalSchema, rawInput, GOAL_INVALID)
  return refusingSharedGoals(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      await assertMoneyAccount(tx, goal.accountId)
      return { goalId: await insertGoal(tx, { workspaceId, ...goal }) }
    }),
  )
}

export async function changeGoal(
  db: Database,
  { workspaceId, goalId }: GoalRef,
  rawChange: unknown,
): Promise<void> {
  const change = parseOrThrow(goalChangeSchema, rawChange, GOAL_INVALID)
  await refusingSharedGoals(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      await lockExistingGoal(tx, goalId)
      if (change.accountId) {
        await assertMoneyAccount(tx, change.accountId)
      }
      await updateGoal(tx, goalId, change)
    }),
  )
}

export async function deleteGoal(
  db: Database,
  { workspaceId, goalId, userId, reason }: DeleteGoalInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockExistingGoal(tx, goalId)
    await updateGoal(tx, goalId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: reason ?? null,
    })
  })
}

async function lockExistingGoal(tx: WorkspaceTransaction, goalId: string): Promise<GoalRow> {
  const goal = await lockActiveGoal(tx, goalId)
  if (!goal) {
    throw new NotFoundError('GOAL_NOT_FOUND', `Goal ${goalId} not found`)
  }
  return goal
}

async function assertMoneyAccount(tx: WorkspaceTransaction, accountId: string): Promise<void> {
  const account = (await loadUsableAccounts(tx, [accountId])).get(accountId)
  if (!account || !MONEY_KINDS.has(account.kind)) {
    throw new ValidationError('GOAL_ACCOUNT_INVALID', 'A goal is kept in a money account')
  }
}

async function refusingSharedGoals<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const conflict = CONFLICT_OF_CONSTRAINT[postgresConstraintName(error) ?? '']
    if (postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION && conflict) {
      throw new ConflictError(conflict[0], conflict[1], { cause: error })
    }
    throw error
  }
}

function itemOf(goal: GoalRow, savedCents: number): GoalItem {
  return {
    id: goal.id,
    name: goal.name,
    targetCents: goal.targetCents,
    targetOn: goal.targetOn,
    accountId: goal.accountId,
    isReserve: goal.isReserve,
    savedCents,
  }
}
