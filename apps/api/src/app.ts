import { healthRoutes } from '@api/modules/health'
import { Hono } from 'hono'

export type AppDeps = {
  version: string
  startedAt: number
  isDatabaseReachable: () => Promise<boolean>
}

export function createApp(deps: AppDeps) {
  return new Hono().route('/api/health', healthRoutes(deps))
}

export type AppType = ReturnType<typeof createApp>
