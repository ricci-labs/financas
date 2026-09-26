import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import { loadUsableAccounts } from '@api/modules/ledger'
import {
  insertRule,
  lockActiveRule,
  selectActiveRules,
  updateRule,
} from '@api/modules/planning/planning.repository'
import type {
  CreatedRecurrenceRule,
  DeleteRecurrenceRuleInput,
  PlanningContext,
  RecurrenceRuleItem,
  RecurrenceRuleRef,
  RecurrenceRuleRow,
} from '@api/modules/planning/planning.types'
import {
  newRecurrenceRuleSchema,
  type RecurrenceSchedule,
  type RecurringEntryType,
  recurrenceRuleChangeSchema,
  recurringAccountsFit,
} from '@financas/shared'

const RULE_INVALID = 'RECURRENCE_INVALID'

export function listRecurrenceRules(
  db: Database,
  workspaceId: string,
): Promise<RecurrenceRuleItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => (await selectActiveRules(tx)).map(itemOf))
}

export async function createRecurrenceRule(
  db: Database,
  { workspaceId }: PlanningContext,
  rawInput: unknown,
): Promise<CreatedRecurrenceRule> {
  const { schedule, ...rule } = parseOrThrow(newRecurrenceRuleSchema, rawInput, RULE_INVALID)
  return withWorkspace(db, workspaceId, async (tx) => {
    await assertAccountsFit(tx, rule.entryType, rule.sourceAccountId, rule.categoryAccountId)
    return { ruleId: await insertRule(tx, { workspaceId, ...rule, ...schedule }) }
  })
}

export async function changeRecurrenceRule(
  db: Database,
  { workspaceId, ruleId }: RecurrenceRuleRef,
  rawChange: unknown,
): Promise<void> {
  const { schedule, ...change } = parseOrThrow(recurrenceRuleChangeSchema, rawChange, RULE_INVALID)
  await withWorkspace(db, workspaceId, async (tx) => {
    const current = await lockExistingRule(tx, ruleId)
    await assertAccountsFit(
      tx,
      current.entryType,
      change.sourceAccountId ?? current.sourceAccountId,
      change.categoryAccountId ?? current.categoryAccountId,
    )
    await updateRule(tx, ruleId, { ...change, ...schedule })
  })
}

export async function deleteRecurrenceRule(
  db: Database,
  { workspaceId, ruleId, userId, reason }: DeleteRecurrenceRuleInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockExistingRule(tx, ruleId)
    await updateRule(tx, ruleId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: reason ?? null,
    })
  })
}

async function lockExistingRule(
  tx: WorkspaceTransaction,
  ruleId: string,
): Promise<RecurrenceRuleRow> {
  const rule = await lockActiveRule(tx, ruleId)
  if (!rule) {
    throw new NotFoundError('RECURRENCE_NOT_FOUND', `Recurrence rule ${ruleId} not found`)
  }
  return rule
}

async function assertAccountsFit(
  tx: WorkspaceTransaction,
  entryType: RecurringEntryType,
  sourceAccountId: string,
  categoryAccountId: string,
): Promise<void> {
  const accounts = await loadUsableAccounts(tx, [sourceAccountId, categoryAccountId])
  const source = accounts.get(sourceAccountId)
  const category = accounts.get(categoryAccountId)
  if (!source || !category || !recurringAccountsFit(entryType, source, category)) {
    throw new ValidationError(
      'RECURRENCE_ACCOUNTS_INVALID',
      `The accounts don't fit a recurring ${entryType}`,
    )
  }
}

function itemOf(row: RecurrenceRuleRow): RecurrenceRuleItem {
  const schedule: RecurrenceSchedule = {
    frequency: row.frequency,
    interval: row.interval,
    dayOfMonth: row.dayOfMonth,
    nthBusinessDay: row.nthBusinessDay,
    weekendRule: row.weekendRule,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
  }
  return {
    id: row.id,
    description: row.description,
    entryType: row.entryType,
    amountCents: row.amountCents,
    amountIsEstimate: row.amountIsEstimate,
    sourceAccountId: row.sourceAccountId,
    categoryAccountId: row.categoryAccountId,
    schedule,
    remindDaysBefore: row.remindDaysBefore,
    autoRecord: row.autoRecord,
  }
}
