export type NewWorkspace = {
  id: string
  name: string
  createdByUserId: string
}

export type WorkspaceDefaults = {
  currency: string
  timezone: string
}

export type WorkspaceSummary = {
  workspaceId: string
  name: string
  isArchived: boolean
}
