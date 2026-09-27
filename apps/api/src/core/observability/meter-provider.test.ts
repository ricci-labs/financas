import { loadEnv } from '@api/core/config/env'
import { startMetrics } from '@api/core/observability/meter-provider'
import { appMetrics } from '@api/core/observability/metrics'
import { metrics } from '@opentelemetry/api'
import { afterAll, describe, expect, it } from 'vitest'

const DATABASE_URL = 'postgres://app:app@127.0.0.1:5433/financas'
const TEST_PORT = 19464

afterAll(() => {
  metrics.disable()
})

describe('startMetrics', () => {
  it('starts nothing unless the Prometheus exporter is chosen', () => {
    expect(startMetrics(loadEnv({ DATABASE_URL }))).toBeUndefined()
  })

  it('serves the metrics with the service name on the configured port', async () => {
    const provider = startMetrics(
      loadEnv({
        DATABASE_URL,
        APP_VERSION: 'abc1234',
        OTEL_METRICS_EXPORTER: 'prometheus',
        OTEL_EXPORTER_PROMETHEUS_HOST: '127.0.0.1',
        OTEL_EXPORTER_PROMETHEUS_PORT: String(TEST_PORT),
      }),
    )
    appMetrics().jobRuns.add(1, { job: 'probe', outcome: 'ok' })

    const scraped = await (await fetch(`http://127.0.0.1:${TEST_PORT}/metrics`)).text()
    await provider?.shutdown()

    expect(scraped).toContain('financas_job_runs_total{job="probe",outcome="ok"} 1')
    expect(scraped).toMatch(
      /target_info\{[^}]*service_name="financas-api"[^}]*service_version="abc1234"/,
    )
  })
})
