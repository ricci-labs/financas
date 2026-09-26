import type { IsoDate } from '@shared/calendar/calendar.types'
import { daysBetween } from '@shared/calendar/dates'
import {
  APPROXIMATE_DAYS_PER_STEP,
  MATCH_TOLERANCE_PERCENT,
  MATCH_WINDOW_DAYS,
} from '@shared/recurrence/recurrence.constants'
import type { MatchableEntry, MatchableOccurrence } from '@shared/recurrence/recurrence.types'

const PERCENT = 100

export function entryFitsOccurrence(
  entry: MatchableEntry,
  occurrence: MatchableOccurrence,
): boolean {
  const touchedAccounts = new Set(entry.postings.map((posting) => posting.accountId))
  return (
    entry.entryType === occurrence.entryType &&
    touchedAccounts.has(occurrence.sourceAccountId) &&
    touchedAccounts.has(occurrence.categoryAccountId)
  )
}

export function suggestedOccurrences<T extends MatchableOccurrence>(
  entry: MatchableEntry,
  occurrences: readonly T[],
): T[] {
  return occurrences
    .filter(
      (occurrence) =>
        entryFitsOccurrence(entry, occurrence) &&
        isAmountClose(entry, occurrence) &&
        isDateClose(entry.occurredOn, occurrence),
    )
    .sort(
      (left, right) =>
        daysAway(entry.occurredOn, left.dueOn) - daysAway(entry.occurredOn, right.dueOn) ||
        amountGap(entry, left) - amountGap(entry, right),
    )
}

export function entryAmountFor(entry: MatchableEntry, occurrence: MatchableOccurrence): number {
  const onCategory = entry.postings
    .filter((posting) => posting.accountId === occurrence.categoryAccountId)
    .reduce((sum, posting) => sum + posting.amountCents, 0)
  return Math.abs(onCategory)
}

function isAmountClose(entry: MatchableEntry, occurrence: MatchableOccurrence): boolean {
  const tolerance = occurrence.amountIsEstimate
    ? MATCH_TOLERANCE_PERCENT.estimate
    : MATCH_TOLERANCE_PERCENT.fixed
  return amountGap(entry, occurrence) * PERCENT <= occurrence.amountCents * tolerance
}

function isDateClose(occurredOn: IsoDate, occurrence: MatchableOccurrence): boolean {
  const halfStep = (APPROXIMATE_DAYS_PER_STEP[occurrence.frequency] * occurrence.interval) / 2
  return daysAway(occurredOn, occurrence.dueOn) <= Math.min(MATCH_WINDOW_DAYS, halfStep)
}

function daysAway(occurredOn: IsoDate, dueOn: IsoDate): number {
  return Math.abs(daysBetween(dueOn, occurredOn))
}

function amountGap(entry: MatchableEntry, occurrence: MatchableOccurrence): number {
  return Math.abs(entryAmountFor(entry, occurrence) - occurrence.amountCents)
}
