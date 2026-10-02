export const WORKSPACE_KEY_PREFIX = 'w'

export const queryKeys = {
  me: ['me'] as const,
  authConfig: ['auth-config'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: string) => [WORKSPACE_KEY_PREFIX, workspaceId] as const,
}
