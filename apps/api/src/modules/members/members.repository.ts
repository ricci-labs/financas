import type { WorkspaceTransaction } from '@api/core/db/tx'
import { membershipPreferences, memberships } from '@api/modules/members/members.table'
import type { NewMembership } from '@api/modules/members/members.types'

export async function insertMembership(tx: WorkspaceTransaction, membership: NewMembership) {
  const [inserted] = await tx
    .insert(memberships)
    .values(membership)
    .returning({ id: memberships.id })
  if (!inserted) {
    throw new Error('Membership was not inserted')
  }
  return inserted.id
}

export async function insertDefaultPreferencesIfMissing(
  tx: WorkspaceTransaction,
  { workspaceId, userId }: Pick<NewMembership, 'workspaceId' | 'userId'>,
) {
  await tx.insert(membershipPreferences).values({ workspaceId, userId }).onConflictDoNothing()
}
