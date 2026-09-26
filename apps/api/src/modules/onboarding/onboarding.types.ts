import type { BackgroundTasks } from '@api/core/background-tasks.types'
import type { Database } from '@api/core/db/db.types'
import type { Mailer } from '@api/core/email/email.types'
import type { LinkLimitDeps } from '@api/modules/identity'
import type { InvitationRequest, SystemRoleKey } from '@financas/shared'

export type CreateWorkspaceInput = {
  name: string
  ownerUserId: string
}

export type CreatedWorkspace = {
  workspaceId: string
  ownerMembershipId: string
}

export type RegisterOwnerInput = {
  email: string
  displayName: string
  password: string
  workspaceName: string
}

export type RegisteredOwner = {
  userId: string
  workspaceId: string
}

export type InviteMemberInput = {
  workspaceId: string
  inviterUserId: string
  inviterRoleKey: SystemRoleKey | null
  request: InvitationRequest
}

export type IssuedInvitation = {
  invitationId: string
  expiresAt: Date
  shareableLink: string | null
}

export type InvitationOutcome = {
  invitation: IssuedInvitation
  emailToSend: InvitationEmailInput | null
}

export type InvitationPreview = {
  workspaceName: string
  inviterName: string
  roleName: string
  email: string | null
  isPhoneInvitation: boolean
  expiresAt: Date
}

export type AcceptAsUserInput = {
  token: string
  userId: string
}

export type InvitationEmailInput = {
  workspaceId: string
  inviterUserId: string
  email: string
  inviteLink: string
}

export type InvitationEmail = {
  recipientEmail: string
  workspaceName: string
  inviterName: string
  inviteLink: string
}

export type InvitationDeps = {
  mailer: Mailer
  publicUrl: string
}

export type OnboardingRouteDeps = InvitationDeps &
  LinkLimitDeps & {
    db: Database
    background: BackgroundTasks
  }
