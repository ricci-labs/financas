import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import { POSTGRES_UNIQUE_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, ValidationError } from '@api/core/http/errors'
import { findActiveEntry } from '@api/modules/ledger'
import {
  selectOccurrencesBetween,
  setOccurrenceMatch,
} from '@api/modules/planning/planning.repository'
import type { OccurrenceItem, OccurrenceRef } from '@api/modules/planning/planning.types'
import {
  lockExistingOccurrence,
  refreshOccurrences,
  withOverdueFlag,
  workspaceToday,
} from '@api/modules/planning/use-cases/occurrences'
import {
  addDays,
  entryFitsOccurrence,
  MATCH_WINDOW_DAYS,
  suggestedOccurrences,
} from '@financas/shared'

export function suggestOccurrencesForEntry(
  db: Database,
  workspaceId: string,
  entryId: string,
  clock: Clock = systemClock,
): Promise<OccurrenceItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const entry = await findActiveEntry(tx, entryId)
    if (!entry) {
      throw new NotFoundError('ENTRY_NOT_FOUND', `Entry ${entryId} not found`)
    }
    const today = await workspaceToday(tx, clock)
    await refreshOccurrences(tx, today)
    const nearby = await selectOccurrencesBetween(
      tx,
      addDays(entry.occurredOn, -MATCH_WINDOW_DAYS),
      addDays(entry.occurredOn, MATCH_WINDOW_DAYS),
    )
    const pending = nearby.filter((occurrence) => occurrence.status === 'pending')
    return suggestedOccurrences(entry, pending).map((occurrence) =>
      withOverdueFlag(occurrence, today),
    )
  })
}

export async function matchOccurrence(
  db: Database,
  { workspaceId, occurrenceId }: OccurrenceRef,
  entryId: string,
): Promise<void> {
  await refusingEntriesAlreadyMatched(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      const occurrence = await lockExistingOccurrence(tx, occurrenceId)
      if (occurrence.status !== 'pending') {
        throw new ConflictError(
          'OCCURRENCE_NOT_PENDING',
          `Occurrence ${occurrenceId} is not pending`,
        )
      }
      const entry = await findActiveEntry(tx, entryId)
      if (!entry) {
        throw new ValidationError('ENTRY_NOT_AVAILABLE', `Entry ${entryId} is not available`)
      }
      if (!entryFitsOccurrence(entry, occurrence)) {
        throw new ValidationError(
          'OCCURRENCE_ENTRY_MISMATCH',
          'The entry does not move the accounts of this occurrence',
        )
      }
      await setOccurrenceMatch(tx, occurrenceId, entryId)
    }),
  )
}

export async function unmatchOccurrence(
  db: Database,
  { workspaceId, occurrenceId }: OccurrenceRef,
) {
  await withWorkspace(db, workspaceId, async (tx) => {
    const occurrence = await lockExistingOccurrence(tx, occurrenceId)
    if (occurrence.status !== 'matched') {
      throw new ConflictError('OCCURRENCE_NOT_MATCHED', `Occurrence ${occurrenceId} is not matched`)
    }
    await setOccurrenceMatch(tx, occurrenceId, null)
  })
}

async function refusingEntriesAlreadyMatched<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION) {
      throw new ConflictError(
        'ENTRY_ALREADY_MATCHED',
        'The entry already pays another occurrence',
        {
          cause: error,
        },
      )
    }
    throw error
  }
}
