import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { readAccountFacts, readPostingFacts } from '@api/modules/ledger'
import {
  holidayDatesOf,
  readBudgetFacts,
  readOccurrenceFacts,
  readReserveFact,
  workspaceToday,
} from '@api/modules/planning'
import type { PeriodOverview, PeriodTimeline } from '@api/modules/reports/reports.types'
import { currentWorkspaceSettings } from '@api/modules/workspaces'
import {
  addMonths,
  clampedDate,
  computeMetrics,
  type IsoDate,
  type OverviewQuery,
  type PeriodFacts,
  type PeriodSettings,
  parseIsoDate,
  periodOf,
  periodSettingsOf,
  periodStartingIn,
} from '@financas/shared'

const LAST_DAY = 31
const RECENT_PERIODS = 6

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
  const { period, recentPeriods } = await resolvePeriods(
    tx,
    label,
    today,
    periodSettingsOf(settings.periodAnchor, settings.periodAnchorValue),
  )
  const earliest = recentPeriods[0]?.start ?? period.start
  return {
    today,
    period,
    recentPeriods,
    installmentBudgetView: settings.installmentBudgetView,
    budgetBase: settings.budgetBase,
    accounts: await readAccountFacts(tx),
    postings: await readPostingFacts(tx, earliest, period.end),
    occurrences: await readOccurrenceFacts(tx, { from: period.start, to: period.end }, today),
    budgets: await readBudgetFacts(tx, period.label),
    reserve: await readReserveFact(tx),
  }
}

async function resolvePeriods(
  tx: WorkspaceTransaction,
  label: string | undefined,
  today: IsoDate,
  settings: PeriodSettings,
): Promise<PeriodTimeline> {
  const reference = parseIsoDate(label ? `${label}-01` : today)
  const holidays = await holidayDatesOf(
    tx,
    clampedDate(addMonths(reference, -(RECENT_PERIODS + 1)), 1),
    clampedDate(addMonths(reference, 1), LAST_DAY),
  )
  const period = label
    ? periodStartingIn(reference, settings, holidays)
    : periodOf(today, settings, holidays)
  const labelMonth = parseIsoDate(`${period.label}-01`)
  const recentPeriods = Array.from({ length: RECENT_PERIODS }, (_, index) =>
    periodStartingIn(addMonths(labelMonth, index - RECENT_PERIODS), settings, holidays),
  )
  return { period, recentPeriods }
}
