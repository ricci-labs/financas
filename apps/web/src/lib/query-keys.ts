const WORKSPACE_PREFIX = 'w'

export const queryKeys = {
  me: ['me'] as const,
  authConfig: ['auth-config'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: string) => [WORKSPACE_PREFIX, workspaceId] as const,
}
