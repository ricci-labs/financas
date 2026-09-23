import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import { invitations, membershipPreferences, memberships } from '@api/modules/members/members.table'
import type { NewMembership } from '@api/modules/members/members.types'
import { and, eq, isNull, sql } from 'drizzle-orm'

type NewInvitation = typeof invitations.$inferInsert

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

export async function hasActiveMembership(tx: WorkspaceTransaction, userId: string) {
  const [found] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)))
  return found !== undefined
}

export async function insertInvitation(tx: WorkspaceTransaction, invitation: NewInvitation) {
  const [inserted] = await tx
    .insert(invitations)
    .values(invitation)
    .returning({ id: invitations.id })
  if (!inserted) {
    throw new Error('Invitation was not inserted')
  }
  return inserted.id
}

export async function findInvitationWorkspaceId(db: Database, tokenHash: string) {
  const result = await db.execute<{ workspace_id: string | null }>(
    sql`select invitation_workspace_id(${tokenHash}) as workspace_id`,
  )
  return result.rows[0]?.workspace_id ?? null
}

export async function findInvitationByTokenHash(tx: WorkspaceTransaction, tokenHash: string) {
  const [invitation] = await tx
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
  return invitation
}

export async function markInvitationAccepted(
  tx: WorkspaceTransaction,
  invitationId: string,
  acceptedByUserId: string,
  acceptedAt: Date,
) {
  await tx
    .update(invitations)
    .set({ acceptedAt, acceptedByUserId })
    .where(eq(invitations.id, invitationId))
}
