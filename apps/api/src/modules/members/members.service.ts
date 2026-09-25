import { type Clock, systemClock } from '@api/core/clock'
import type { Database } from '@api/core/db/client'
import { type WorkspaceTransaction, withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError } from '@api/core/http/errors'
import { generateToken, hashToken } from '@api/core/security/tokens'
import {
  findInvitationWorkspaceId,
  hasActiveMembership,
  insertDefaultPreferencesIfMissing,
  insertInvitation,
  insertMembership,
  lockInvitationByTokenHash,
  markInvitationAccepted,
} from '@api/modules/members/members.repository'
import type {
  AcceptedInvitation,
  AcceptInvitationInput,
  CreatedInvitation,
  CreateInvitationInput,
  NewMembership,
} from '@api/modules/members/members.types'

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export async function addMember(
  tx: WorkspaceTransaction,
  membership: NewMembership,
): Promise<string> {
  const membershipId = await insertMembership(tx, membership)
  await insertDefaultPreferencesIfMissing(tx, membership)
  return membershipId
}

export async function createInvitation(
  db: Database,
  input: CreateInvitationInput,
  clock: Clock = systemClock,
): Promise<CreatedInvitation> {
  const token = generateToken()
  const expiresAt = new Date(clock.now().getTime() + INVITATION_LIFETIME_MS)

  const invitationId = await withWorkspace(db, input.workspaceId, (tx) =>
    insertInvitation(tx, { ...input, tokenHash: hashToken(token), expiresAt }),
  )
  return { invitationId, token, expiresAt }
}

export async function acceptInvitation(
  db: Database,
  { token, userId }: AcceptInvitationInput,
  clock: Clock = systemClock,
): Promise<AcceptedInvitation> {
  const tokenHash = hashToken(token)
  const workspaceId = await findInvitationWorkspaceId(db, tokenHash)
  if (!workspaceId) {
    throw new NotFoundError('INVITATION_NOT_FOUND', 'Invitation not found')
  }

  return withWorkspace(db, workspaceId, async (tx) => {
    const invitation = await lockInvitationByTokenHash(tx, tokenHash)
    if (!invitation) {
      throw new NotFoundError('INVITATION_NOT_FOUND', 'Invitation not found')
    }

    const now = clock.now()
    assertInvitationIsOpen(invitation, now)
    if (await hasActiveMembership(tx, userId)) {
      throw new ConflictError('ALREADY_MEMBER', 'User is already a member of this workspace')
    }

    const membershipId = await addMember(tx, { workspaceId, userId, roleId: invitation.roleId })
    await markInvitationAccepted(tx, invitation.id, userId, now)
    return { workspaceId, membershipId }
  })
}

type InvitationState = {
  deletedAt: Date | null
  acceptedAt: Date | null
  expiresAt: Date
}

function assertInvitationIsOpen(invitation: InvitationState, now: Date): void {
  if (invitation.deletedAt) {
    throw new ConflictError('INVITATION_REVOKED', 'Invitation was revoked')
  }
  if (invitation.acceptedAt) {
    throw new ConflictError('INVITATION_ALREADY_ACCEPTED', 'Invitation was already accepted')
  }
  if (invitation.expiresAt <= now) {
    throw new ConflictError('INVITATION_EXPIRED', 'Invitation has expired')
  }
}
