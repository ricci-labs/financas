import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { rolePermissions, roles } from '@api/modules/access/access.table'
import type { NewSystemRole, RoleDeletion, RoleDetails } from '@api/modules/access/access.types'
import type { Permission } from '@financas/shared'
import { and, asc, eq, isNull } from 'drizzle-orm'

export async function insertSystemRole(tx: WorkspaceTransaction, role: NewSystemRole) {
  const [inserted] = await tx.insert(roles).values(role).returning({ id: roles.id })
  if (!inserted) {
    throw new Error(`Role ${role.systemKey} was not inserted`)
  }
  return inserted.id
}

export async function insertRolePermissions(
  tx: WorkspaceTransaction,
  workspaceId: string,
  roleId: string,
  permissions: readonly Permission[],
) {
  if (permissions.length === 0) {
    return
  }
  await tx
    .insert(rolePermissions)
    .values(permissions.map(({ module, action }) => ({ workspaceId, roleId, module, action })))
}

export async function selectActiveRole(tx: WorkspaceTransaction, roleId: string) {
  const [role] = await tx
    .select({ roleId: roles.id, name: roles.name, systemKey: roles.systemKey })
    .from(roles)
    .where(and(eq(roles.id, roleId), isNull(roles.deletedAt)))
  return role
}

export function selectRolePermissions(
  tx: WorkspaceTransaction,
  roleId: string,
): Promise<Permission[]> {
  return tx
    .select({ module: rolePermissions.module, action: rolePermissions.action })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId))
}

export function selectActiveRoles(tx: WorkspaceTransaction) {
  return tx
    .select({ roleId: roles.id, name: roles.name, systemKey: roles.systemKey })
    .from(roles)
    .where(isNull(roles.deletedAt))
}

export function selectActiveRolesWithDescriptions(tx: WorkspaceTransaction) {
  return tx
    .select({
      roleId: roles.id,
      name: roles.name,
      systemKey: roles.systemKey,
      description: roles.description,
    })
    .from(roles)
    .where(isNull(roles.deletedAt))
    .orderBy(asc(roles.createdAt))
}

export function selectWorkspacePermissions(tx: WorkspaceTransaction) {
  return tx
    .select({
      roleId: rolePermissions.roleId,
      module: rolePermissions.module,
      action: rolePermissions.action,
    })
    .from(rolePermissions)
}

export async function insertCustomRole(
  tx: WorkspaceTransaction,
  role: { workspaceId: string; name: string; description: string | null },
): Promise<string> {
  const [inserted] = await tx.insert(roles).values(role).returning({ id: roles.id })
  if (!inserted) {
    throw new Error('Role was not inserted')
  }
  return inserted.id
}

export async function lockRole(tx: WorkspaceTransaction, roleId: string) {
  const [role] = await tx
    .select({
      roleId: roles.id,
      name: roles.name,
      systemKey: roles.systemKey,
      deletedAt: roles.deletedAt,
    })
    .from(roles)
    .where(eq(roles.id, roleId))
    .for('update')
  return role
}

export async function updateRoleDetails(
  tx: WorkspaceTransaction,
  roleId: string,
  details: RoleDetails,
): Promise<void> {
  await tx.update(roles).set(details).where(eq(roles.id, roleId))
}

export async function deleteRolePermissions(
  tx: WorkspaceTransaction,
  roleId: string,
): Promise<void> {
  await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
}

export async function markRoleDeleted(
  tx: WorkspaceTransaction,
  roleId: string,
  deletion: RoleDeletion,
): Promise<void> {
  await tx.update(roles).set(deletion).where(eq(roles.id, roleId))
}
