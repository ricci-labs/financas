import type { Database } from '@api/core/db/db.types'
import type {
  BudgetBase,
  InstallmentBudgetView,
  PeriodAnchor,
  WorkspaceSettingsChange,
} from '@financas/shared'

export type NewWorkspace = {
  id: string
  name: string
  createdByUserId: string
}

export type WorkspaceDefaults = {
  currency: string
  timezone: string
}

export type WorkspaceSummary = {
  workspaceId: string
  name: string
  isArchived: boolean
}

export type WorkspaceSettings = {
  currency: string
  timezone: string
  locale: string
  periodAnchor: PeriodAnchor
  periodAnchorValue: number | null
  installmentBudgetView: InstallmentBudgetView
  budgetBase: BudgetBase
  weekStartsOn: number
  pixReceivingKey: string | null
  pixReceiverName: string | null
  pixReceiverCity: string | null
  contactMessagesDailyCap: number
  chargeReminderEveryDays: number | null
}

export type WorkspaceRename = {
  workspaceId: string
  name: string
}

export type SettingsUpdate = Omit<WorkspaceSettingsChange, 'periodAnchorValue'> & {
  periodAnchorValue?: number | null
}

export type WorkspaceRouteDeps = {
  db: Database
}
