import { createBaseApp } from '@api/core/http/base-app'
import type { Logger } from '@api/core/observability/logger'
import { healthRoutes } from '@api/modules/health'

export type AppDeps = {
  version: string
  startedAt: number
  isDatabaseReachable: () => Promise<boolean>
  logger: Logger
}

export function createApp(deps: AppDeps) {
  return createBaseApp(deps.logger).route('/api/health', healthRoutes(deps))
}

export type AppType = ReturnType<typeof createApp>
