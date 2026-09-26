import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { invitations, membershipPreferences, memberships } from '@api/modules/members/members.table'
import type {
  InvitationContact,
  InvitationRevocation,
  NewInvitation,
  NewMembership,
} from '@api/modules/members/members.types'
import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'

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

export async function lockInvitationByTokenHash(tx: WorkspaceTransaction, tokenHash: string) {
  const [invitation] = await tx
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .for('update')
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

export async function selectActiveMembershipOfUser(tx: WorkspaceTransaction, userId: string) {
  const [membership] = await tx
    .select({ membershipId: memberships.id, roleId: memberships.roleId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)))
  return membership
}

export async function selectWorkspaceIdsOfUser(db: Database, userId: string): Promise<string[]> {
  const result = await db.execute<{ workspace_id: string }>(
    sql`select user_workspace_ids(${userId}) as workspace_id`,
  )
  return result.rows.map((row) => row.workspace_id)
}

export async function retireExpiredInvitations(
  tx: WorkspaceTransaction,
  contact: InvitationContact,
  revocation: InvitationRevocation,
): Promise<void> {
  const sameContact =
    'email' in contact
      ? eq(sql`lower(${invitations.email})`, contact.email.toLowerCase())
      : eq(invitations.phoneE164, contact.phoneE164)
  await tx
    .update(invitations)
    .set(revocation)
    .where(
      and(
        sameContact,
        isNull(invitations.acceptedAt),
        isNull(invitations.deletedAt),
        lte(invitations.expiresAt, revocation.deletedAt),
      ),
    )
}

export function selectPendingInvitations(tx: WorkspaceTransaction, now: Date) {
  return tx
    .select({
      invitationId: invitations.id,
      email: invitations.email,
      phoneE164: invitations.phoneE164,
      roleId: invitations.roleId,
      invitedByUserId: invitations.invitedByUserId,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        isNull(invitations.acceptedAt),
        isNull(invitations.deletedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .orderBy(desc(invitations.createdAt))
}

export async function lockInvitation(tx: WorkspaceTransaction, invitationId: string) {
  const [invitation] = await tx
    .select({
      id: invitations.id,
      acceptedAt: invitations.acceptedAt,
      deletedAt: invitations.deletedAt,
    })
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .for('update')
  return invitation
}

export async function markInvitationRevoked(
  tx: WorkspaceTransaction,
  invitationId: string,
  revocation: InvitationRevocation,
): Promise<void> {
  await tx.update(invitations).set(revocation).where(eq(invitations.id, invitationId))
}

export async function selectInvitationByTokenHash(tx: WorkspaceTransaction, tokenHash: string) {
  const [invitation] = await tx
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
  return invitation
}
