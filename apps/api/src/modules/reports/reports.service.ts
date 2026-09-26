import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { readAccountFacts, readPostingFacts } from '@api/modules/ledger'
import { holidayDatesOf, readOccurrenceFacts, workspaceToday } from '@api/modules/planning'
import type { PeriodOverview } from '@api/modules/reports/reports.types'
import { currentWorkspaceSettings } from '@api/modules/workspaces'
import {
  addMonths,
  clampedDate,
  computeMetrics,
  type IsoDate,
  type OverviewQuery,
  type Period,
  type PeriodFacts,
  type PeriodSettings,
  parseIsoDate,
  periodOf,
  periodSettingsOf,
  periodStartingIn,
} from '@financas/shared'

const LAST_DAY = 31

export function getPeriodOverview(
  db: Database,
  workspaceId: string,
  { period: label }: OverviewQuery,
  clock: Clock = systemClock,
): Promise<PeriodOverview> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const facts = await loadPeriodFacts(tx, label, clock)
    return { today: facts.today, period: facts.period, metrics: computeMetrics(facts) }
  })
}

async function loadPeriodFacts(
  tx: WorkspaceTransaction,
  label: string | undefined,
  clock: Clock,
): Promise<PeriodFacts> {
  const settings = await currentWorkspaceSettings(tx)
  const today = await workspaceToday(tx, clock)
  const period = await resolvePeriod(
    tx,
    label,
    today,
    periodSettingsOf(settings.periodAnchor, settings.periodAnchorValue),
  )
  return {
    today,
    period,
    installmentBudgetView: settings.installmentBudgetView,
    budgetBase: settings.budgetBase,
    accounts: await readAccountFacts(tx),
    postings: await readPostingFacts(tx, period.start, period.end),
    occurrences: await readOccurrenceFacts(tx, { from: period.start, to: period.end }, today),
  }
}

async function resolvePeriod(
  tx: WorkspaceTransaction,
  label: string | undefined,
  today: IsoDate,
  settings: PeriodSettings,
): Promise<Period> {
  const month = parseIsoDate(label ? `${label}-01` : today)
  const holidays = await holidayDatesOf(
    tx,
    clampedDate(addMonths(month, -1), 1),
    clampedDate(addMonths(month, 1), LAST_DAY),
  )
  return label ? periodStartingIn(month, settings, holidays) : periodOf(today, settings, holidays)
}
