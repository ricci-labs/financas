import type { Database } from '@api/core/db/db.types'
import type { IsoDate, NationalHoliday } from '@financas/shared'

export type PlanningContext = {
  workspaceId: string
  userId: string
}

export type WorkspaceHoliday = {
  id: string
  onDate: IsoDate
  name: string
}

export type HolidaysOfYear = {
  national: NationalHoliday[]
  workspace: WorkspaceHoliday[]
}

export type AddedHoliday = {
  holidayId: string
}

export type DeleteHolidayInput = PlanningContext & {
  holidayId: string
  reason?: string
}

export type NewWorkspaceHoliday = {
  workspaceId: string
  onDate: IsoDate
  name: string
}

export type HolidayDeletion = {
  deletedAt: Date
  deletedByUserId: string
  deleteReason: string | null
}

export type PlanningRouteDeps = {
  db: Database
}
