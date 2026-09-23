import type { Database } from '@api/core/db/client'
import { withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { createSystemRoles } from '@api/modules/access'
import { addMember } from '@api/modules/members'
import {
  insertDefaultSettings,
  insertWorkspace,
  reserveWorkspaceId,
} from '@api/modules/workspaces/workspaces.repository'
import type {
  CreatedWorkspace,
  CreateWorkspaceInput,
} from '@api/modules/workspaces/workspaces.types'
import { workspaceNameSchema } from '@financas/shared'

export async function createWorkspace(
  db: Database,
  input: CreateWorkspaceInput,
): Promise<CreatedWorkspace> {
  const name = parseWorkspaceName(input.name)
  const workspaceId = await reserveWorkspaceId(db)

  return withWorkspace(db, workspaceId, async (tx) => {
    await insertWorkspace(tx, { id: workspaceId, name, createdByUserId: input.ownerUserId })
    await insertDefaultSettings(tx, workspaceId)
    const systemRoles = await createSystemRoles(tx, workspaceId)
    const ownerMembershipId = await addMember(tx, {
      workspaceId,
      userId: input.ownerUserId,
      roleId: systemRoles.owner,
    })
    return { workspaceId, ownerMembershipId }
  })
}

function parseWorkspaceName(rawName: string): string {
  const parsed = workspaceNameSchema.safeParse(rawName)
  if (!parsed.success) {
    throw new ValidationError(
      'WORKSPACE_NAME_INVALID',
      'Workspace name must have 1 to 80 characters',
    )
  }
  return parsed.data
}
