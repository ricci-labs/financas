import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import {
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError } from '@api/core/http/errors'
import { generateToken, hashToken } from '@api/core/security/tokens'
import {
  findInvitationWorkspaceId,
  hasActiveMembership,
  insertDefaultPreferencesIfMissing,
  insertInvitation,
  insertMembership,
  lockInvitation,
  lockInvitationByTokenHash,
  markInvitationAccepted,
  markInvitationRevoked,
  retireExpiredInvitations,
  selectActiveMembershipOfUser,
  selectPendingInvitations,
  selectWorkspaceIdsOfUser,
} from '@api/modules/members/members.repository'
import type {
  AcceptedInvitation,
  AcceptInvitationInput,
  ActiveMembership,
  CreatedInvitation,
  CreateInvitationInput,
  InvitationContact,
  InvitationState,
  NewMembership,
  PendingInvitation,
  RevocableInvitation,
  RevokeInvitationInput,
} from '@api/modules/members/members.types'

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const EXPIRED_REASON = 'expired'
const REVOKED_REASON = 'revoked'
const PENDING_INVITATION_CONSTRAINTS = new Set([
  'invitations_pending_email_unique',
  'invitations_pending_phone_unique',
])

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
  const now = clock.now()
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS)

  const invitationId = await refusingPendingDuplicate(() =>
    withWorkspace(db, input.workspaceId, async (tx) => {
      await retireExpiredInvitations(tx, contactOf(input), {
        deletedAt: now,
        deletedByUserId: null,
        deleteReason: EXPIRED_REASON,
      })
      return insertInvitation(tx, { ...input, tokenHash: hashToken(token), expiresAt })
    }),
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

export function findActiveMembership(
  tx: WorkspaceTransaction,
  userId: string,
): Promise<ActiveMembership | undefined> {
  return selectActiveMembershipOfUser(tx, userId)
}

export function listWorkspaceIdsOfUser(db: Database, userId: string): Promise<string[]> {
  return selectWorkspaceIdsOfUser(db, userId)
}

export function listPendingInvitations(
  db: Database,
  workspaceId: string,
  clock: Clock = systemClock,
): Promise<PendingInvitation[]> {
  return withWorkspace(db, workspaceId, (tx) => selectPendingInvitations(tx, clock.now()))
}

export async function revokeInvitation(
  db: Database,
  { workspaceId, invitationId, userId }: RevokeInvitationInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    const invitation = await lockInvitation(tx, invitationId)
    if (!invitation) {
      throw new NotFoundError('INVITATION_NOT_FOUND', 'Invitation not found')
    }
    assertInvitationCanBeRevoked(invitation)
    await markInvitationRevoked(tx, invitationId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: REVOKED_REASON,
    })
  })
}

function assertInvitationCanBeRevoked(invitation: RevocableInvitation): void {
  if (invitation.deletedAt) {
    throw new ConflictError('INVITATION_REVOKED', 'Invitation was revoked')
  }
  if (invitation.acceptedAt) {
    throw new ConflictError('INVITATION_ALREADY_ACCEPTED', 'Invitation was already accepted')
  }
}

function contactOf(input: InvitationContact): InvitationContact {
  return 'email' in input ? { email: input.email } : { phoneE164: input.phoneE164 }
}

async function refusingPendingDuplicate<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const isPendingDuplicate =
      postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION &&
      PENDING_INVITATION_CONSTRAINTS.has(postgresConstraintName(error) ?? '')
    if (isPendingDuplicate) {
      throw new ConflictError(
        'INVITATION_PENDING',
        'This contact already has a pending invitation',
        {
          cause: error,
        },
      )
    }
    throw error
  }
}
