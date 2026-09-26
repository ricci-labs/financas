import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import {
  deletePendingOccurrences,
  insertOccurrencesIfMissing,
  selectActiveRules,
  selectOccurrencesBetween,
  selectPlannedDueDates,
} from '@api/modules/planning/planning.repository'
import type { OccurrenceItem, RecurrenceRuleRow } from '@api/modules/planning/planning.types'
import { holidayDatesOf } from '@api/modules/planning/use-cases/holidays'
import { currentWorkspaceDefaults } from '@api/modules/workspaces'
import {
  addDays,
  addMonths,
  clampedDate,
  DAYS_A_DUE_DATE_MAY_SHIFT,
  dueDatesBetween,
  type IsoDate,
  OCCURRENCE_HORIZON_MONTHS,
  type OccurrenceListQuery,
  parseIsoDate,
  type RecurrenceSchedule,
  todayIn,
  withoutDatesNearKept,
} from '@financas/shared'

const LAST_DAY = 31

export async function listOccurrences(
  db: Database,
  workspaceId: string,
  { from, to }: OccurrenceListQuery,
  clock: Clock = systemClock,
): Promise<OccurrenceItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const today = await workspaceToday(tx, clock)
    await refreshOccurrences(tx, today)
    const occurrences = await selectOccurrencesBetween(tx, from, to)
    return occurrences.map((occurrence) => ({
      ...occurrence,
      isOverdue: occurrence.status === 'pending' && occurrence.dueOn < today,
    }))
  })
}

export async function refreshOccurrences(tx: WorkspaceTransaction, today: IsoDate): Promise<void> {
  for (const rule of await selectActiveRules(tx)) {
    await planRuleOccurrences(tx, rule, today)
  }
}

export async function replanRuleOccurrences(
  tx: WorkspaceTransaction,
  rule: RecurrenceRuleRow,
  today: IsoDate,
): Promise<void> {
  await deletePendingOccurrences(tx, rule.id, today)
  await planRuleOccurrences(tx, rule, today)
}

export async function dropPendingOccurrences(
  tx: WorkspaceTransaction,
  ruleId: string,
): Promise<void> {
  await deletePendingOccurrences(tx, ruleId, null)
}

export async function workspaceToday(tx: WorkspaceTransaction, clock: Clock): Promise<IsoDate> {
  const { timezone } = await currentWorkspaceDefaults(tx)
  return todayIn(timezone, clock.now())
}

export function scheduleOf(rule: RecurrenceRuleRow): RecurrenceSchedule {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    dayOfMonth: rule.dayOfMonth,
    nthBusinessDay: rule.nthBusinessDay,
    weekendRule: rule.weekendRule,
    startsOn: rule.startsOn,
    endsOn: rule.endsOn,
  }
}

async function planRuleOccurrences(
  tx: WorkspaceTransaction,
  rule: RecurrenceRuleRow,
  today: IsoDate,
): Promise<void> {
  const from = rule.startsOn > today ? rule.startsOn : today
  const to = horizonEndOf(today)
  const holidays = await holidayDatesOf(
    tx,
    addDays(clampedDate(parseIsoDate(from), 1), -DAYS_A_DUE_DATE_MAY_SHIFT),
    addDays(to, DAYS_A_DUE_DATE_MAY_SHIFT),
  )
  const dueDates = dueDatesBetween(scheduleOf(rule), { from, to }, holidays)
  const toPlan = withoutDatesNearKept(dueDates, await selectPlannedDueDates(tx, rule.id), rule)
  if (toPlan.length === 0) {
    return
  }
  await insertOccurrencesIfMissing(
    tx,
    toPlan.map((dueOn) => ({
      workspaceId: rule.workspaceId,
      ruleId: rule.id,
      dueOn,
      amountCents: rule.amountCents,
    })),
  )
}

function horizonEndOf(today: IsoDate): IsoDate {
  return clampedDate(addMonths(parseIsoDate(today), OCCURRENCE_HORIZON_MONTHS), LAST_DAY)
}
