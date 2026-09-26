import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, parseOrThrow } from '@api/core/http/errors'
import { updateOccurrence } from '@api/modules/planning/planning.repository'
import type { OccurrenceRef } from '@api/modules/planning/planning.types'
import { lockExistingOccurrence } from '@api/modules/planning/use-cases/occurrences'
import { type OccurrenceStatus, occurrenceChangeSchema } from '@financas/shared'

export async function skipOccurrence(db: Database, ref: OccurrenceRef): Promise<void> {
  await moveStatus(db, ref, 'pending', 'skipped')
}

export async function unskipOccurrence(db: Database, ref: OccurrenceRef): Promise<void> {
  await moveStatus(db, ref, 'skipped', 'pending')
}

export async function changeOccurrenceAmount(
  db: Database,
  { workspaceId, occurrenceId }: OccurrenceRef,
  rawChange: unknown,
): Promise<void> {
  const { amountCents } = parseOrThrow(occurrenceChangeSchema, rawChange, 'OCCURRENCE_INVALID')
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockInStatus(tx, occurrenceId, 'pending')
    await updateOccurrence(tx, occurrenceId, { amountCents })
  })
}

async function moveStatus(
  db: Database,
  { workspaceId, occurrenceId }: OccurrenceRef,
  from: OccurrenceStatus,
  to: OccurrenceStatus,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockInStatus(tx, occurrenceId, from)
    await updateOccurrence(tx, occurrenceId, { status: to })
  })
}

async function lockInStatus(
  tx: WorkspaceTransaction,
  occurrenceId: string,
  expected: OccurrenceStatus,
): Promise<void> {
  const occurrence = await lockExistingOccurrence(tx, occurrenceId)
  if (occurrence.status !== expected) {
    throw new ConflictError(
      `OCCURRENCE_NOT_${expected.toUpperCase()}`,
      `Occurrence ${occurrenceId} is ${occurrence.status}, not ${expected}`,
    )
  }
}
