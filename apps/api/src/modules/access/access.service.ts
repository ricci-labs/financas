import type { WorkspaceTransaction } from '@api/core/db/tx'
import { insertRolePermissions, insertSystemRole } from '@api/modules/access/access.repository'
import type { SystemRoleIds } from '@api/modules/access/access.types'
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
