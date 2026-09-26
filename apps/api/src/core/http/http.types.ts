import type { Logger } from '@api/core/observability/logger'

export type RequestVariables = {
  requestId: string
  logger: Logger
}

export type AppEnv = {
  Variables: RequestVariables
}
