import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { pageLink } from '@api/core/email/links'
import { ForbiddenError, NotFoundError, ValidationError } from '@api/core/http/errors'
import { createSystemRoles, findRole, listRolePermissions } from '@api/modules/access'
import {
  createUser,
  getAccount,
  type IdentityDeps,
  requestEmailVerification,
} from '@api/modules/identity'
import { createSystemAccounts } from '@api/modules/ledger'
import {
  type AcceptedInvitation,
  acceptInvitation,
  addMember,
  createInvitation,
  describeInvitation,
} from '@api/modules/members'
import { invitationMessage } from '@api/modules/onboarding/onboarding.emails'
import type {
  AcceptAsUserInput,
  CreatedWorkspace,
  CreateWorkspaceInput,
  InvitationDeps,
  InvitationEmailInput,
  InvitationOutcome,
  InvitationPreview,
  InviteMemberInput,
  JoinedThroughSignUp,
  RegisteredOwner,
  RegisterOwnerInput,
  SignUpThroughInvitationDeps,
  SignUpThroughInvitationInput,
} from '@api/modules/onboarding/onboarding.types'
import { addWorkspace, findCurrentWorkspace, reserveWorkspaceId } from '@api/modules/workspaces'
import { permissionsBeyond, workspaceNameSchema } from '@financas/shared'

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
  { workspaceId, inviterUserId, inviterRoleKey, inviterPermissions, request }: InviteMemberInput,
  deps: InvitationDeps,
): Promise<InvitationOutcome> {
  const role = await findRole(db, { workspaceId, roleId: request.roleId })
  if (!role) {
    throw new ValidationError('ROLE_NOT_AVAILABLE', 'The role does not exist in this workspace')
  }
  const isOwnerInvitation = role.systemKey === OWNER_ROLE
  if (isOwnerInvitation && inviterRoleKey !== OWNER_ROLE) {
    throw new ForbiddenError('OWNER_ONLY', 'Only an owner can invite another owner')
  }
  const rolePermissions = await listRolePermissions(db, { workspaceId, roleId: role.roleId })
  if (permissionsBeyond(inviterPermissions, rolePermissions).length > 0) {
    throw new ForbiddenError(
      'PERMISSION_ESCALATION',
      'You can only invite with permissions you have yourself',
    )
  }

  const created = await createInvitation(db, {
    ...request,
    workspaceId,
    invitedByUserId: inviterUserId,
  })
  const inviteLink = pageLink(deps.publicUrl, INVITE_PATH, created.token)
  const isEmailInvitation = 'email' in request
  return {
    invitation: {
      invitationId: created.invitationId,
      expiresAt: created.expiresAt,
      shareableLink: isEmailInvitation ? null : inviteLink,
    },
    emailToSend: isEmailInvitation
      ? { workspaceId, inviterUserId, email: request.email, inviteLink }
      : null,
  }
}

export async function previewInvitation(db: Database, token: string): Promise<InvitationPreview> {
  const invitation = await describeInvitation(db, token)
  const { workspaceId } = invitation
  const workspace = await withWorkspace(db, workspaceId, (tx) => findCurrentWorkspace(tx))
  const role = await findRole(db, { workspaceId, roleId: invitation.roleId })
  if (!workspace || !role) {
    throw new NotFoundError('INVITATION_NOT_FOUND', 'Invitation not found')
  }
  const inviter = await getAccount(db, invitation.invitedByUserId)
  return {
    workspaceName: workspace.name,
    inviterName: inviter.displayName,
    roleName: role.name,
    email: invitation.email,
    isPhoneInvitation: invitation.phoneE164 !== null,
    expiresAt: invitation.expiresAt,
  }
}

export async function acceptInvitationAsUser(
  db: Database,
  { token, userId }: AcceptAsUserInput,
): Promise<AcceptedInvitation> {
  const account = await getAccount(db, userId)
  return acceptInvitation(db, { token, userId, userEmail: account.email })
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

export async function signUpThroughInvitation(
  db: Database,
  input: SignUpThroughInvitationInput,
  deps: SignUpThroughInvitationDeps,
): Promise<JoinedThroughSignUp> {
  const invitation = await describeInvitation(db, input.token, deps.clock)
  const email = invitation.email ?? input.email
  if (!email) {
    throw new ValidationError('EMAIL_REQUIRED', 'A phone invitation needs an email for the account')
  }

  const isEmailVerified = invitation.email !== null
  const userId = await createUser(
    db,
    { email, displayName: input.displayName, password: input.password, isEmailVerified },
    deps,
  )
  const accepted = await acceptInvitation(db, { token: input.token, userId, userEmail: email })
  if (!isEmailVerified) {
    await requestEmailVerification(db, { email }, deps)
  }
  return { ...accepted, isEmailVerified }
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
