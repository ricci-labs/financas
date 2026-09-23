import type { HealthDeps } from '@api/modules/health/health.types'
import { Hono } from 'hono'

const MILLISECONDS_PER_SECOND = 1000
const SERVICE_UNAVAILABLE = 503

export function healthRoutes({
  version,
  startedAt,
  isDatabaseReachable,
  now = Date.now,
}: HealthDeps) {
  const uptimeSeconds = () => Math.floor((now() - startedAt) / MILLISECONDS_PER_SECOND)

  return new Hono()
    .get('/live', (c) => c.json({ status: 'ok' as const }))
    .get('/ready', async (c) => {
      const databaseIsUp = await isDatabaseReachable()
      const body = {
        status: databaseIsUp ? ('ok' as const) : ('degraded' as const),
        database: databaseIsUp ? ('up' as const) : ('down' as const),
        version,
        uptimeS: uptimeSeconds(),
      }
      return databaseIsUp ? c.json(body) : c.json(body, SERVICE_UNAVAILABLE)
    })
}
