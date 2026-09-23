import { Hono } from 'hono'

export type HealthDeps = {
  version: string
  startedAt: number
  now?: () => number
}

const MILLISECONDS_PER_SECOND = 1000

export function healthRoutes({ version, startedAt, now = Date.now }: HealthDeps) {
  const uptimeSeconds = () => Math.floor((now() - startedAt) / MILLISECONDS_PER_SECOND)

  return new Hono()
    .get('/live', (c) => c.json({ status: 'ok' as const }))
    .get('/ready', (c) => c.json({ status: 'ok' as const, version, uptimeS: uptimeSeconds() }))
}
