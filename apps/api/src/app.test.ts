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
      SMTP_PORT: 587,
      EMAIL_FROM_NAME: 'Finanças',
      EMAIL_OUTBOX_DIR: '.private/outbox',
    })
  })

  it('reads the SMTP settings', () => {
    const env = loadEnv({
      DATABASE_URL: LOCAL_DATABASE_URL,
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '465',
      SMTP_SECURE: 'false',
      SMTP_USER: 'sender',
      SMTP_PASSWORD: 'smtp-secret-value',
      EMAIL_FROM: 'no-reply@example.test',
    })
    expect(env).toMatchObject({
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: 465,
      SMTP_SECURE: false,
      SMTP_USER: 'sender',
      EMAIL_FROM: 'no-reply@example.test',
    })
  })

  it('requires SMTP_USER and SMTP_PASSWORD together, without printing the password', () => {
    const onlyPassword = { DATABASE_URL: LOCAL_DATABASE_URL, SMTP_PASSWORD: 'smtp-secret-value' }
    expect(() => loadEnv(onlyPassword)).toThrow(/SMTP_USER: SMTP_USER and SMTP_PASSWORD/)
    expect(() => loadEnv(onlyPassword)).not.toThrow(/smtp-secret-value/)
  })

  it('requires SMTP_HOST and EMAIL_FROM in production only', () => {
    const production = { DATABASE_URL: LOCAL_DATABASE_URL, NODE_ENV: 'production' }
    expect(() => loadEnv(production)).toThrow(
      /SMTP_HOST: required in production; EMAIL_FROM: required in production/,
    )
    expect(() =>
      loadEnv({
        ...production,
        SMTP_HOST: 'smtp.example.test',
        EMAIL_FROM: 'no-reply@example.test',
      }),
    ).not.toThrow()
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
