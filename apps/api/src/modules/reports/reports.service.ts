import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import {
  readAccountFacts,
  readCardFacts,
  readInvoiceFacts,
  readPostingFacts,
} from '@api/modules/ledger'
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
  addDays,
  addMonths,
  clampedDate,
  computeInsights,
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
const UPCOMING_PERIODS = 6
const DAYS_IN_A_CARD_CYCLE = 31

export function getPeriodOverview(
  db: Database,
  workspaceId: string,
  { period: label }: OverviewQuery,
  clock: Clock = systemClock,
): Promise<PeriodOverview> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const facts = await loadPeriodFacts(tx, label, clock)
    const metrics = computeMetrics(facts)
    return {
      today: facts.today,
      period: facts.period,
      metrics,
      insights: computeInsights(facts, metrics),
    }
  })
}

async function loadPeriodFacts(
  tx: WorkspaceTransaction,
  label: string | undefined,
  clock: Clock,
): Promise<PeriodFacts> {
  const settings = await currentWorkspaceSettings(tx)
  const today = await workspaceToday(tx, clock)
  const { period, recentPeriods, upcomingPeriods } = await resolvePeriods(
    tx,
    label,
    today,
    periodSettingsOf(settings.periodAnchor, settings.periodAnchorValue),
  )
  const earliest = recentPeriods[0]?.start ?? period.start
  const latest = upcomingPeriods.at(-1)?.end ?? period.end
  const cycleStart = addDays(today, -DAYS_IN_A_CARD_CYCLE)
  const occurrencesFrom = cycleStart < period.start ? cycleStart : period.start
  return {
    today,
    period,
    recentPeriods,
    upcomingPeriods,
    installmentBudgetView: settings.installmentBudgetView,
    budgetBase: settings.budgetBase,
    accounts: await readAccountFacts(tx),
    postings: await readPostingFacts(tx, earliest, latest),
    occurrences: await readOccurrenceFacts(tx, { from: occurrencesFrom, to: latest }, today),
    budgets: await readBudgetFacts(tx, period.label),
    reserve: await readReserveFact(tx),
    cards: await readCardFacts(tx),
    invoices: await readInvoiceFacts(tx, cycleStart),
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
    clampedDate(addMonths(reference, UPCOMING_PERIODS + 1), LAST_DAY),
  )
  const period = label
    ? periodStartingIn(reference, settings, holidays)
    : periodOf(today, settings, holidays)
  const labelMonth = parseIsoDate(`${period.label}-01`)
  const recentPeriods = Array.from({ length: RECENT_PERIODS }, (_, index) =>
    periodStartingIn(addMonths(labelMonth, index - RECENT_PERIODS), settings, holidays),
  )
  const upcomingPeriods = Array.from({ length: UPCOMING_PERIODS }, (_, index) =>
    periodStartingIn(addMonths(labelMonth, index + 1), settings, holidays),
  )
  return { period, recentPeriods, upcomingPeriods }
}
