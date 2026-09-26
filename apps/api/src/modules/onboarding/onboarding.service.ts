import type { Database } from '@api/core/db/client'
import { withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { createSystemRoles } from '@api/modules/access'
import { createUser, type IdentityDeps } from '@api/modules/identity'
import { createSystemAccounts } from '@api/modules/ledger'
import { addMember } from '@api/modules/members'
import type {
  CreatedWorkspace,
  CreateWorkspaceInput,
  RegisteredOwner,
  RegisterOwnerInput,
} from '@api/modules/onboarding/onboarding.types'
import { addWorkspace, reserveWorkspaceId } from '@api/modules/workspaces'
import { workspaceNameSchema } from '@financas/shared'

export async function createWorkspace(
  db: Database,
  input: CreateWorkspaceInput,
): Promise<CreatedWorkspace> {
  const name = parseWorkspaceName(input.name)
  const workspaceId = await reserveWorkspaceId(db)

  return withWorkspace(db, workspaceId, async (tx) => {
    const { currency } = await addWorkspace(tx, {
      id: workspaceId,
      name,
      createdByUserId: input.ownerUserId,
    })
    await createSystemAccounts(tx, workspaceId, currency)
    const systemRoles = await createSystemRoles(tx, workspaceId)
    const ownerMembershipId = await addMember(tx, {
      workspaceId,
      userId: input.ownerUserId,
      roleId: systemRoles.owner,
    })
    return { workspaceId, ownerMembershipId }
  })
}

export async function registerOwner(
  db: Database,
  input: RegisterOwnerInput,
  identityDeps: Partial<IdentityDeps> = {},
): Promise<RegisteredOwner> {
  const workspaceName = parseWorkspaceName(input.workspaceName)
  const userId = await createUser(
    db,
    {
      email: input.email,
      displayName: input.displayName,
      password: input.password,
      isEmailVerified: true,
    },
    identityDeps,
  )
  const { workspaceId } = await createWorkspace(db, { name: workspaceName, ownerUserId: userId })
  return { userId, workspaceId }
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
