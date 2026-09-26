import type { Logger } from '@api/core/observability/logger'

export type RequestSession = {
  sessionId: string
  userId: string
}

export type RequestVariables = {
  requestId: string
  logger: Logger
  session?: RequestSession
  errorCode?: string
}

export type AppEnv = {
  Variables: RequestVariables
}
