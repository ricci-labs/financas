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
