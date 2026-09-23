import { createApp } from '@api/app'
import { loadEnv } from '@api/core/config/env'
import { describe, expect, it } from 'vitest'

describe('health routes', () => {
  const app = createApp({ version: 'test-sha', startedAt: Date.now() - 5_000 })

  it('GET /api/health/live', async () => {
    const res = await app.request('/api/health/live')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/health/ready reports version and uptime', async () => {
    const res = await app.request('/api/health/ready')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', version: 'test-sha', uptimeS: 5 })
  })
})

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3100,
      LOG_LEVEL: 'info',
      APP_VERSION: 'dev',
    })
  })

  it('fails with a readable message', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/Invalid environment: PORT/)
  })
})
