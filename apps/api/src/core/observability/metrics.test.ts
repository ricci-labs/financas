import type { Database } from '@api/core/db/db.types'
import { createBaseApp } from '@api/core/http/base-app'
import { runJob } from '@api/jobs/scheduler'
import { createCapturingLogger } from '@api/testing/logger'
import { createRecordingMailer } from '@api/testing/mailer'
import { captureMetrics } from '@api/testing/metrics'
import { createMemoryFileStorage } from '@api/testing/storage'
import { describe, expect, it } from 'vitest'

const captured = captureMetrics()

function jobDeps() {
  return {
    db: {} as Database,
    clock: { now: () => new Date('2026-10-01T12:00:00Z') },
    logger: createCapturingLogger().logger,
    mailer: createRecordingMailer().mailer,
    publicUrl: 'http://localhost:5173',
    fileStorage: createMemoryFileStorage().storage,
    timezone: 'America/Sao_Paulo',
  }
}

describe('HTTP metrics', () => {
  it('time every request by route pattern, method and status, never by real path', async () => {
    const app = createBaseApp(createCapturingLogger().logger).get('/api/items/:itemId', (c) =>
      c.json({ ok: true }),
    )
    await app.request('/api/items/0198-private-id')
    await app.request('/api/nothing-here')

    const scraped = await captured.scrape()
    expect(scraped).toMatch(
      /http_server_request_duration_count\{[^}]*http_route="\/api\/items\/:itemId"[^}]*http_response_status_code="200"[^}]*\} 1/,
    )
    expect(scraped).toMatch(/http_response_status_code="404"/)
    expect(scraped).not.toContain('0198-private-id')
  })
})

describe('job metrics', () => {
  it('count runs by outcome and keep the time of the last success', async () => {
    await runJob({ name: 'good-job', schedule: '* * * * *', run: async () => ({}) }, jobDeps())
    await runJob(
      {
        name: 'bad-job',
        schedule: '* * * * *',
        run: async () => {
          throw new Error('boom')
        },
      },
      jobDeps(),
    )

    const scraped = await captured.scrape()
    expect(scraped).toContain('financas_job_runs_total{job="good-job",outcome="ok"} 1')
    expect(scraped).toContain('financas_job_runs_total{job="bad-job",outcome="error"} 1')
    expect(scraped).toContain(
      'financas_job_last_success_timestamp_seconds{job="good-job"} 1790856000',
    )
    expect(scraped).not.toContain('financas_job_last_success_timestamp_seconds{job="bad-job"}')
  })
})
