import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { recurrenceRules, workspaceHolidays } from '@api/modules/planning/planning.table'
import type {
  HolidayDeletion,
  NewRecurrenceRuleRow,
  NewWorkspaceHoliday,
  RecurrenceRuleRow,
  RecurrenceRuleUpdate,
  WorkspaceHoliday,
} from '@api/modules/planning/planning.types'
import type { IsoDate } from '@financas/shared'
import { and, asc, between, eq, isNull } from 'drizzle-orm'

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
