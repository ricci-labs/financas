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
