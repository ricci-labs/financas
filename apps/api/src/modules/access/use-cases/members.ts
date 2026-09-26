import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { POSTGRES_CHECK_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, ForbiddenError, ValidationError } from '@api/core/http/errors'
import { selectActiveRole, selectActiveRoles } from '@api/modules/access/access.repository'
import type {
  ChangeMemberRoleInput,
  MemberActor,
  MemberItem,
  RemoveMemberInput,
  WorkspaceRole,
} from '@api/modules/access/access.types'
import { listAccounts } from '@api/modules/identity'
import {
  listActiveMemberships,
  lockActiveMembership,
  removeMembership,
  setMembershipRole,
} from '@api/modules/members'

const OWNER_ROLE = 'owner'

export async function listMembers(db: Database, workspaceId: string): Promise<MemberItem[]> {
  const { memberships, rolesById } = await withWorkspace(db, workspaceId, async (tx) => ({
    memberships: await listActiveMemberships(tx),
    rolesById: new Map((await selectActiveRoles(tx)).map((role) => [role.roleId, role])),
  }))
  const accounts = await listAccounts(
    db,
    memberships.map((membership) => membership.userId),
  )
  const accountsById = new Map(accounts.map((account) => [account.userId, account]))

  return memberships.flatMap((membership) => {
    const account = accountsById.get(membership.userId)
    const role = rolesById.get(membership.roleId)
    if (!account || !role) {
      return []
    }
    return [
      {
        membershipId: membership.membershipId,
        userId: membership.userId,
        displayName: account.displayName,
        email: account.email,
        role,
        joinedAt: membership.joinedAt,
      },
    ]
  })
}

export async function changeMemberRole(
  db: Database,
  { actor, membershipId, roleId }: ChangeMemberRoleInput,
): Promise<void> {
  await keepingAnOwner(() =>
    withWorkspace(db, actor.workspaceId, async (tx) => {
      const membership = await lockActiveMembership(tx, membershipId)
      const currentRole = await activeRole(tx, membership.roleId)
      const newRole = await activeRole(tx, roleId)
      assertMayManage(actor, [currentRole, newRole])
      await setMembershipRole(tx, membershipId, roleId)
    }),
  )
}

export async function removeMember(
  db: Database,
  { actor, membershipId, reason }: RemoveMemberInput,
  clock: Clock = systemClock,
): Promise<void> {
  await keepingAnOwner(() =>
    withWorkspace(db, actor.workspaceId, async (tx) => {
      const membership = await lockActiveMembership(tx, membershipId)
      const isLeaving = membership.userId === actor.userId
      if (!isLeaving) {
        assertMayManage(actor, [await activeRole(tx, membership.roleId)])
      }
      await removeMembership(tx, membershipId, {
        deletedAt: clock.now(),
        deletedByUserId: actor.userId,
        deleteReason: reason ?? null,
      })
    }),
  )
}

async function activeRole(tx: WorkspaceTransaction, roleId: string): Promise<WorkspaceRole> {
  const role = await selectActiveRole(tx, roleId)
  if (!role) {
    throw new ValidationError('ROLE_NOT_AVAILABLE', 'The role does not exist in this workspace')
  }
  return role
}

function assertMayManage(actor: MemberActor, involvedRoles: WorkspaceRole[]): void {
  const touchesAnOwner = involvedRoles.some((role) => role.systemKey === OWNER_ROLE)
  if (touchesAnOwner && actor.roleKey !== OWNER_ROLE) {
    throw new ForbiddenError('OWNER_ONLY', 'Only an owner can manage owners')
  }
}

async function keepingAnOwner<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_CHECK_VIOLATION) {
      throw new ConflictError('LAST_OWNER', 'A workspace must keep at least one owner', {
        cause: error,
      })
    }
    throw error
  }
}
