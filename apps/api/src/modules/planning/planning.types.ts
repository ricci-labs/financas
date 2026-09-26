import type { Database } from '@api/core/db/db.types'
import type { plannedOccurrences, recurrenceRules } from '@api/modules/planning/planning.table'
import type {
  IsoDate,
  NationalHoliday,
  OccurrenceStatus,
  RecurrenceFrequency,
  RecurrenceSchedule,
  RecurringEntryType,
} from '@financas/shared'

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

export type RecurrenceRuleRow = typeof recurrenceRules.$inferSelect

export type NewRecurrenceRuleRow = typeof recurrenceRules.$inferInsert

export type RecurrenceRuleUpdate = Partial<
  Omit<NewRecurrenceRuleRow, 'workspaceId' | 'id' | 'entryType' | 'createdAt' | 'updatedAt'>
>

export type RecurrenceRuleItem = {
  id: string
  description: string
  entryType: RecurringEntryType
  amountCents: number
  amountIsEstimate: boolean
  sourceAccountId: string
  categoryAccountId: string
  schedule: RecurrenceSchedule
  remindDaysBefore: number | null
  autoRecord: boolean
}

export type CreatedRecurrenceRule = {
  ruleId: string
}

export type RecurrenceRuleRef = {
  workspaceId: string
  ruleId: string
}

export type DeleteRecurrenceRuleInput = RecurrenceRuleRef & {
  userId: string
  reason?: string
}

export type RuleDeletion = HolidayDeletion

export type NewOccurrenceRow = typeof plannedOccurrences.$inferInsert

export type OccurrenceRow = {
  id: string
  ruleId: string
  description: string
  entryType: RecurringEntryType
  sourceAccountId: string
  categoryAccountId: string
  dueOn: IsoDate
  amountCents: number
  amountIsEstimate: boolean
  status: OccurrenceStatus
  matchedEntryId: string | null
  frequency: RecurrenceFrequency
  interval: number
}

export type OccurrenceItem = OccurrenceRow & {
  isOverdue: boolean
}

export type OccurrenceRef = {
  workspaceId: string
  occurrenceId: string
}

export type LockedOccurrence = OccurrenceRow
