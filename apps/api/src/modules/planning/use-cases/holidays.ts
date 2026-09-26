import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { POSTGRES_UNIQUE_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, parseOrThrow } from '@api/core/http/errors'
import {
  insertHoliday,
  markHolidayDeleted,
  selectHolidaysBetween,
} from '@api/modules/planning/planning.repository'
import type {
  AddedHoliday,
  DeleteHolidayInput,
  HolidaysOfYear,
  PlanningContext,
} from '@api/modules/planning/planning.types'
import {
  holidayDatesBetween,
  type IsoDate,
  nationalHolidays,
  newHolidaySchema,
  toIsoDate,
} from '@financas/shared'

const DECEMBER = 12
const LAST_DAY_OF_DECEMBER = 31

export function listHolidays(
  db: Database,
  workspaceId: string,
  year: number,
): Promise<HolidaysOfYear> {
  return withWorkspace(db, workspaceId, async (tx) => ({
    national: nationalHolidays(year),
    workspace: await selectHolidaysBetween(
      tx,
      toIsoDate(year, 1, 1),
      toIsoDate(year, DECEMBER, LAST_DAY_OF_DECEMBER),
    ),
  }))
}

export async function addHoliday(
  db: Database,
  { workspaceId }: PlanningContext,
  rawInput: unknown,
): Promise<AddedHoliday> {
  const input = parseOrThrow(newHolidaySchema, rawInput, 'HOLIDAY_INVALID')
  const year = Number(input.onDate.slice(0, 4))
  if (nationalHolidays(year).some((holiday) => holiday.on === input.onDate)) {
    throw new ConflictError('HOLIDAY_ALREADY_NATIONAL', `${input.onDate} is a national holiday`)
  }
  return refusingTakenHolidayDates(() =>
    withWorkspace(db, workspaceId, async (tx) => ({
      holidayId: await insertHoliday(tx, { workspaceId, onDate: input.onDate, name: input.name }),
    })),
  )
}

export async function deleteHoliday(
  db: Database,
  { workspaceId, userId, holidayId, reason }: DeleteHolidayInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    const wasDeleted = await markHolidayDeleted(tx, holidayId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: reason ?? null,
    })
    if (!wasDeleted) {
      throw new NotFoundError('HOLIDAY_NOT_FOUND', `Holiday ${holidayId} not found`)
    }
  })
}

export async function holidayDatesOf(
  tx: WorkspaceTransaction,
  start: IsoDate,
  end: IsoDate,
): Promise<ReadonlySet<IsoDate>> {
  const workspaceDates = (await selectHolidaysBetween(tx, start, end)).map(
    (holiday) => holiday.onDate,
  )
  return holidayDatesBetween(start, end, workspaceDates)
}

async function refusingTakenHolidayDates<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION) {
      throw new ConflictError('HOLIDAY_DATE_TAKEN', 'This day already has a holiday', {
        cause: error,
      })
    }
    throw error
  }
}
