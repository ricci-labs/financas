import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { rolePermissions, roles } from '@api/modules/access/access.table'
import type { NewSystemRole } from '@api/modules/access/access.types'
import type { Permission } from '@financas/shared'
import { and, eq, isNull } from 'drizzle-orm'

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
