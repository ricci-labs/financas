import type { HealthDeps } from '@api/modules/health/health.types'
import { Hono } from 'hono'

const MILLISECONDS_PER_SECOND = 1000

export function healthRoutes({ version, startedAt, now = Date.now }: HealthDeps) {
  const uptimeSeconds = () => Math.floor((now() - startedAt) / MILLISECONDS_PER_SECOND)

  return new Hono()
    .get('/live', (c) => c.json({ status: 'ok' as const }))
    .get('/ready', (c) => c.json({ status: 'ok' as const, version, uptimeS: uptimeSeconds() }))
}
