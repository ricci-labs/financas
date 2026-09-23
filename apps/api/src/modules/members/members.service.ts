import type { WorkspaceTransaction } from '@api/core/db/tx'
import {
  insertDefaultPreferencesIfMissing,
  insertMembership,
} from '@api/modules/members/members.repository'
import type { NewMembership } from '@api/modules/members/members.types'

export async function addMember(
  tx: WorkspaceTransaction,
  membership: NewMembership,
): Promise<string> {
  const membershipId = await insertMembership(tx, membership)
  await insertDefaultPreferencesIfMissing(tx, membership)
  return membershipId
}
