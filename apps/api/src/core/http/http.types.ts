import type { Logger } from '@api/core/observability/logger'
import type { Permission } from '@financas/shared'

export type RequestSession = {
  sessionId: string
  userId: string
}

export type RequestWorkspace = {
  workspaceId: string
  membershipId: string
  permissions: readonly Permission[]
}

export type RequestVariables = {
  requestId: string
  logger: Logger
  session?: RequestSession
  workspace?: RequestWorkspace
  errorCode?: string
}

export type AppEnv = {
  Variables: RequestVariables
}
