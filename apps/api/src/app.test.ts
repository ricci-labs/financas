import { createApp } from '@api/app'
import { loadEnv } from '@api/core/config/env'
import { describe, expect, it } from 'vitest'

const FIVE_SECONDS_AGO = Date.now() - 5_000
const LOCAL_DATABASE_URL = 'postgres://app:secret@localhost:5433/financas'

function appWithDatabase(isUp: boolean) {
  return createApp({
    version: 'test-sha',
    startedAt: FIVE_SECONDS_AGO,
    isDatabaseReachable: async () => isUp,
  })
}

describe('health routes', () => {
  it('GET /api/health/live', async () => {
    const res = await appWithDatabase(true).request('/api/health/live')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/health/ready reports version, uptime and database', async () => {
    const res = await appWithDatabase(true).request('/api/health/ready')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      status: 'ok',
      database: 'up',
      version: 'test-sha',
      uptimeS: 5,
    })
  })

  it('GET /api/health/ready answers 503 when the database is down', async () => {
    const res = await appWithDatabase(false).request('/api/health/ready')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ status: 'degraded', database: 'down' })
  })
})

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({ DATABASE_URL: LOCAL_DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3100,
      LOG_LEVEL: 'info',
      APP_VERSION: 'dev',
      DATABASE_URL: LOCAL_DATABASE_URL,
    })
  })

  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/)
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x@y/z' })).toThrow(/DATABASE_URL/)
  })

  it('fails with a readable message', () => {
    expect(() => loadEnv({ PORT: 'abc', DATABASE_URL: LOCAL_DATABASE_URL })).toThrow(
      /Invalid environment: PORT/,
    )
  })
})
