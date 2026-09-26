import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import {
  POSTGRES_CHECK_VIOLATION,
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, ForbiddenError, NotFoundError } from '@api/core/http/errors'
import {
  deleteRolePermissions,
  insertCustomRole,
  insertRolePermissions,
  lockRole,
  markRoleDeleted,
  selectActiveRolesWithDescriptions,
  selectWorkspacePermissions,
  updateRoleDetails,
} from '@api/modules/access/access.repository'
import type {
  ChangeRoleInput,
  CreateRoleInput,
  DeleteRoleInput,
  MemberActor,
  RoleItem,
} from '@api/modules/access/access.types'
import { type Permission, permissionsBeyond } from '@financas/shared'

const OWNER_ROLE = 'owner'
const ROLE_NAME_CONSTRAINT = 'roles_name_unique'

export async function listRoles(db: Database, workspaceId: string): Promise<RoleItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const roles = await selectActiveRolesWithDescriptions(tx)
    const permissions = await selectWorkspacePermissions(tx)
    return roles.map((role) => ({
      ...role,
      permissions: permissions
        .filter((permission) => permission.roleId === role.roleId)
        .map(({ module, action }) => ({ module, action })),
    }))
  })
}

export async function createRole(
  db: Database,
  { actor, role }: CreateRoleInput,
): Promise<{ roleId: string }> {
  assertMayGrant(actor, role.permissions)
  return refusingTakenRoleNames(() =>
    withWorkspace(db, actor.workspaceId, async (tx) => {
      const roleId = await insertCustomRole(tx, {
        workspaceId: actor.workspaceId,
        name: role.name,
        description: role.description ?? null,
      })
      await insertRolePermissions(tx, actor.workspaceId, roleId, role.permissions)
      return { roleId }
    }),
  )
}

export async function changeRole(
  db: Database,
  { actor, roleId, change }: ChangeRoleInput,
): Promise<void> {
  if (change.permissions) {
    assertMayGrant(actor, change.permissions)
  }
  await refusingTakenRoleNames(() =>
    withWorkspace(db, actor.workspaceId, async (tx) => {
      await lockEditableRole(tx, roleId)
      await updateRoleDetails(tx, roleId, { name: change.name, description: change.description })
      if (change.permissions) {
        await deleteRolePermissions(tx, roleId)
        await insertRolePermissions(tx, actor.workspaceId, roleId, change.permissions)
      }
    }),
  )
}

export async function deleteRole(
  db: Database,
  { actor, roleId, reason }: DeleteRoleInput,
  clock: Clock = systemClock,
): Promise<void> {
  try {
    await withWorkspace(db, actor.workspaceId, async (tx) => {
      const role = await lockActiveRole(tx, roleId)
      if (role.systemKey) {
        throw new ConflictError('SYSTEM_ROLE', 'System roles cannot be deleted')
      }
      await markRoleDeleted(tx, roleId, {
        deletedAt: clock.now(),
        deletedByUserId: actor.userId,
        deleteReason: reason ?? null,
      })
    })
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_CHECK_VIOLATION) {
      throw new ConflictError('ROLE_IN_USE', 'A member or a pending invitation uses this role', {
        cause: error,
      })
    }
    throw error
  }
}

export function assertMayGrant(actor: MemberActor, permissions: readonly Permission[]): void {
  const beyond = permissionsBeyond(actor.permissions, permissions)
  if (beyond.length > 0) {
    throw new ForbiddenError(
      'PERMISSION_ESCALATION',
      'You can only grant permissions you have yourself',
    )
  }
}

async function lockActiveRole(tx: WorkspaceTransaction, roleId: string) {
  const role = await lockRole(tx, roleId)
  if (!role || role.deletedAt) {
    throw new NotFoundError('ROLE_NOT_FOUND', 'Role not found')
  }
  return role
}

async function lockEditableRole(tx: WorkspaceTransaction, roleId: string) {
  const role = await lockActiveRole(tx, roleId)
  if (role.systemKey === OWNER_ROLE) {
    throw new ForbiddenError('OWNER_ROLE_LOCKED', 'The owner role cannot be changed')
  }
  return role
}

async function refusingTakenRoleNames<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const isTakenName =
      postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION &&
      postgresConstraintName(error) === ROLE_NAME_CONSTRAINT
    if (isTakenName) {
      throw new ConflictError('ROLE_NAME_TAKEN', 'Another role here has this name', {
        cause: error,
      })
    }
    throw error
  }
}
