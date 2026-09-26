import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import {
  insertRolePermissions,
  insertSystemRole,
  selectActiveRole,
  selectRolePermissions,
} from '@api/modules/access/access.repository'
import type {
  RoleRef,
  SystemRoleIds,
  WorkspaceAccess,
  WorkspaceAccessInput,
  WorkspaceListItem,
  WorkspaceRole,
} from '@api/modules/access/access.types'
import { findActiveMembership, listWorkspaceIdsOfUser } from '@api/modules/members'
import { findCurrentWorkspace } from '@api/modules/workspaces'
import { ROLE_TEMPLATES } from '@financas/shared'

export async function createSystemRoles(
  tx: WorkspaceTransaction,
  workspaceId: string,
): Promise<SystemRoleIds> {
  const createdRoles = []
  for (const template of ROLE_TEMPLATES) {
    const roleId = await insertSystemRole(tx, {
      workspaceId,
      name: template.name,
      systemKey: template.key,
    })
    await insertRolePermissions(tx, workspaceId, roleId, template.permissions)
    createdRoles.push([template.key, roleId] as const)
  }
  return Object.fromEntries(createdRoles) as SystemRoleIds
}

export function loadWorkspaceAccess(
  db: Database,
  { workspaceId, userId }: WorkspaceAccessInput,
): Promise<WorkspaceAccess | null> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const workspace = await findCurrentWorkspace(tx)
    const membership = workspace ? await findActiveMembership(tx, userId) : undefined
    const role = membership ? await selectActiveRole(tx, membership.roleId) : undefined
    if (!workspace || !membership || !role) {
      return null
    }

    const permissions = await selectRolePermissions(tx, role.roleId)
    return { workspace, membershipId: membership.membershipId, role, permissions }
  })
}

export async function listWorkspacesOfUser(
  db: Database,
  userId: string,
): Promise<WorkspaceListItem[]> {
  const items: WorkspaceListItem[] = []
  for (const workspaceId of await listWorkspaceIdsOfUser(db, userId)) {
    const access = await loadWorkspaceAccess(db, { workspaceId, userId })
    if (access) {
      items.push({ ...access.workspace, role: access.role })
    }
  }
  return items.sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
}

export function findRole(
  db: Database,
  { workspaceId, roleId }: RoleRef,
): Promise<WorkspaceRole | undefined> {
  return withWorkspace(db, workspaceId, (tx) => selectActiveRole(tx, roleId))
}

export { changeMemberRole, listMembers, removeMember } from '@api/modules/access/use-cases/members'
export {
  changeRole,
  createRole,
  deleteRole,
  listRoles,
} from '@api/modules/access/use-cases/roles'

export function listRolePermissions(db: Database, { workspaceId, roleId }: RoleRef) {
  return withWorkspace(db, workspaceId, (tx) => selectRolePermissions(tx, roleId))
}
