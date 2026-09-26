import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { pageLink } from '@api/core/email/links'
import { ForbiddenError, ValidationError } from '@api/core/http/errors'
import { createSystemRoles, findRole } from '@api/modules/access'
import { createUser, getAccount, type IdentityDeps } from '@api/modules/identity'
import { createSystemAccounts } from '@api/modules/ledger'
import { addMember, createInvitation } from '@api/modules/members'
import { invitationMessage } from '@api/modules/onboarding/onboarding.emails'
import type {
  CreatedWorkspace,
  CreateWorkspaceInput,
  InvitationDeps,
  InvitationEmailInput,
  InviteMemberInput,
  IssuedInvitation,
  RegisteredOwner,
  RegisterOwnerInput,
} from '@api/modules/onboarding/onboarding.types'
import { addWorkspace, findCurrentWorkspace, reserveWorkspaceId } from '@api/modules/workspaces'
import { workspaceNameSchema } from '@financas/shared'

const OWNER_ROLE = 'owner'
const INVITE_PATH = '/invite'

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

export async function inviteMember(
  db: Database,
  { workspaceId, inviterUserId, inviterRoleKey, request }: InviteMemberInput,
  deps: InvitationDeps,
): Promise<IssuedInvitation> {
  const role = await findRole(db, { workspaceId, roleId: request.roleId })
  if (!role) {
    throw new ValidationError('ROLE_NOT_AVAILABLE', 'The role does not exist in this workspace')
  }
  const isOwnerInvitation = role.systemKey === OWNER_ROLE
  if (isOwnerInvitation && inviterRoleKey !== OWNER_ROLE) {
    throw new ForbiddenError('OWNER_ONLY', 'Only an owner can invite another owner')
  }

  const created = await createInvitation(db, {
    ...request,
    workspaceId,
    invitedByUserId: inviterUserId,
  })
  return {
    invitationId: created.invitationId,
    expiresAt: created.expiresAt,
    inviteLink: pageLink(deps.publicUrl, INVITE_PATH, created.token),
  }
}

export async function sendInvitationEmail(
  db: Database,
  { workspaceId, inviterUserId, email, inviteLink }: InvitationEmailInput,
  deps: InvitationDeps,
): Promise<void> {
  const workspace = await withWorkspace(db, workspaceId, (tx) => findCurrentWorkspace(tx))
  if (!workspace) {
    throw new ValidationError('WORKSPACE_NOT_AVAILABLE', 'The workspace was deleted')
  }
  const inviter = await getAccount(db, inviterUserId)
  await deps.mailer.send(
    invitationMessage({
      recipientEmail: email,
      workspaceName: workspace.name,
      inviterName: inviter.displayName,
      inviteLink,
    }),
  )
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
