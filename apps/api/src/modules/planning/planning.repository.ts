import type { WorkspaceTransaction } from '@api/core/db/db.types'
import {
  plannedOccurrences,
  recurrenceRules,
  workspaceHolidays,
} from '@api/modules/planning/planning.table'
import type {
  HolidayDeletion,
  NewOccurrenceRow,
  NewRecurrenceRuleRow,
  NewWorkspaceHoliday,
  OccurrenceRow,
  RecurrenceRuleRow,
  RecurrenceRuleUpdate,
  WorkspaceHoliday,
} from '@api/modules/planning/planning.types'
import type { IsoDate } from '@financas/shared'
import { and, asc, between, eq, gte, isNull } from 'drizzle-orm'

export function selectHolidaysBetween(
  tx: WorkspaceTransaction,
  start: IsoDate,
  end: IsoDate,
): Promise<WorkspaceHoliday[]> {
  return tx
    .select({
      id: workspaceHolidays.id,
      onDate: workspaceHolidays.onDate,
      name: workspaceHolidays.name,
    })
    .from(workspaceHolidays)
    .where(and(isNull(workspaceHolidays.deletedAt), between(workspaceHolidays.onDate, start, end)))
    .orderBy(asc(workspaceHolidays.onDate))
}

export async function insertHoliday(
  tx: WorkspaceTransaction,
  holiday: NewWorkspaceHoliday,
): Promise<string> {
  const [inserted] = await tx
    .insert(workspaceHolidays)
    .values(holiday)
    .returning({ id: workspaceHolidays.id })
  if (!inserted) {
    throw new Error('Holiday insert returned no row')
  }
  return inserted.id
}

export async function markHolidayDeleted(
  tx: WorkspaceTransaction,
  holidayId: string,
  deletion: HolidayDeletion,
): Promise<boolean> {
  const deleted = await tx
    .update(workspaceHolidays)
    .set(deletion)
    .where(and(eq(workspaceHolidays.id, holidayId), isNull(workspaceHolidays.deletedAt)))
    .returning({ id: workspaceHolidays.id })
  return deleted.length > 0
}

export function selectActiveRules(tx: WorkspaceTransaction): Promise<RecurrenceRuleRow[]> {
  return tx
    .select()
    .from(recurrenceRules)
    .where(isNull(recurrenceRules.deletedAt))
    .orderBy(asc(recurrenceRules.description), asc(recurrenceRules.id))
}

export async function lockActiveRule(
  tx: WorkspaceTransaction,
  ruleId: string,
): Promise<RecurrenceRuleRow | undefined> {
  const [rule] = await tx
    .select()
    .from(recurrenceRules)
    .where(and(eq(recurrenceRules.id, ruleId), isNull(recurrenceRules.deletedAt)))
    .for('update')
  return rule
}

export async function insertRule(
  tx: WorkspaceTransaction,
  rule: NewRecurrenceRuleRow,
): Promise<string> {
  const [inserted] = await tx
    .insert(recurrenceRules)
    .values(rule)
    .returning({ id: recurrenceRules.id })
  if (!inserted) {
    throw new Error('Recurrence rule was not inserted')
  }
  return inserted.id
}

export async function updateRule(
  tx: WorkspaceTransaction,
  ruleId: string,
  update: RecurrenceRuleUpdate,
): Promise<void> {
  await tx.update(recurrenceRules).set(update).where(eq(recurrenceRules.id, ruleId))
}

export async function selectPlannedDueDates(
  tx: WorkspaceTransaction,
  ruleId: string,
): Promise<IsoDate[]> {
  const planned = await tx
    .select({ dueOn: plannedOccurrences.dueOn })
    .from(plannedOccurrences)
    .where(eq(plannedOccurrences.ruleId, ruleId))
  return planned.map((occurrence) => occurrence.dueOn)
}

export async function deletePendingOccurrences(
  tx: WorkspaceTransaction,
  ruleId: string,
  fromDate: IsoDate | null,
): Promise<void> {
  const pendingOfRule = and(
    eq(plannedOccurrences.ruleId, ruleId),
    eq(plannedOccurrences.status, 'pending'),
  )
  await tx
    .delete(plannedOccurrences)
    .where(fromDate ? and(pendingOfRule, gte(plannedOccurrences.dueOn, fromDate)) : pendingOfRule)
}

export async function insertOccurrencesIfMissing(
  tx: WorkspaceTransaction,
  occurrences: NewOccurrenceRow[],
): Promise<void> {
  await tx
    .insert(plannedOccurrences)
    .values(occurrences)
    .onConflictDoNothing({ target: [plannedOccurrences.ruleId, plannedOccurrences.dueOn] })
}

export function selectOccurrencesBetween(
  tx: WorkspaceTransaction,
  from: IsoDate,
  to: IsoDate,
): Promise<OccurrenceRow[]> {
  return tx
    .select({
      id: plannedOccurrences.id,
      ruleId: plannedOccurrences.ruleId,
      description: recurrenceRules.description,
      entryType: recurrenceRules.entryType,
      sourceAccountId: recurrenceRules.sourceAccountId,
      categoryAccountId: recurrenceRules.categoryAccountId,
      dueOn: plannedOccurrences.dueOn,
      amountCents: plannedOccurrences.amountCents,
      amountIsEstimate: recurrenceRules.amountIsEstimate,
      status: plannedOccurrences.status,
      matchedEntryId: plannedOccurrences.matchedEntryId,
    })
    .from(plannedOccurrences)
    .innerJoin(recurrenceRules, eq(recurrenceRules.id, plannedOccurrences.ruleId))
    .where(between(plannedOccurrences.dueOn, from, to))
    .orderBy(asc(plannedOccurrences.dueOn), asc(recurrenceRules.description))
}
