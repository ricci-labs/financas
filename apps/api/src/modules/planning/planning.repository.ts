import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { workspaceHolidays } from '@api/modules/planning/planning.table'
import type {
  HolidayDeletion,
  NewWorkspaceHoliday,
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
