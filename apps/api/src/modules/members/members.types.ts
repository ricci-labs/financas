import type { invitations } from '@api/modules/members/members.table'
export type NewMembership = {
  workspaceId: string
  userId: string
  roleId: string
}

export type InvitationContact = { email: string } | { phoneE164: string }

export type CreateInvitationInput = InvitationContact & {
  workspaceId: string
  roleId: string
  invitedByUserId: string
}

export type CreatedInvitation = {
  invitationId: string
  token: string
  expiresAt: Date
}

export type AcceptInvitationInput = {
  token: string
  userId: string
}

export type AcceptedInvitation = {
  workspaceId: string
  membershipId: string
}

export type ActiveMembership = {
  membershipId: string
  roleId: string
}

export type NewInvitation = typeof invitations.$inferInsert

export type InvitationState = {
  deletedAt: Date | null
  acceptedAt: Date | null
  expiresAt: Date
}

export type PendingInvitation = {
  invitationId: string
  email: string | null
  phoneE164: string | null
  roleId: string
  invitedByUserId: string
  expiresAt: Date
  createdAt: Date
}

export type InvitationRef = {
  workspaceId: string
  invitationId: string
}

export type RevokeInvitationInput = InvitationRef & {
  userId: string
}

export type InvitationRevocation = {
  deletedAt: Date
  deletedByUserId: string | null
  deleteReason: string
}

export type RevocableInvitation = Omit<InvitationState, 'expiresAt'>
