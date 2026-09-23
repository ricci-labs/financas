export type CreateWorkspaceInput = {
  name: string
  ownerUserId: string
}

export type CreatedWorkspace = {
  workspaceId: string
  ownerMembershipId: string
}
