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

export type SessionCookieSettings = {
  name: string
  isSecure: boolean
}

export type ResolvedSession = {
  sessionId: string
  userId: string
  expiresAt: Date
  isRenewed: boolean
}

export type SessionGuardOptions = {
  resolve: (token: string) => Promise<ResolvedSession | null>
  publicRoutes: ReadonlySet<string>
  cookie: SessionCookieSettings
}

export type NodeBindings = {
  incoming?: { socket?: { remoteAddress?: string } }
}

export type ErrorBody = {
  error: { code: string; message: string; ref: string }
}

export type Completion = {
  method: string
  route: string
  status: number
  code: string | undefined
  durationMs: number
}
