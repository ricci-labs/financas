import { type Meter, metrics } from '@opentelemetry/api'

export const METER_NAME = 'financas-api'
const HTTP_DURATION_BUCKETS_S = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

let instruments: AppMetrics | undefined

export function createInstruments(meter: Meter) {
  return {
    httpRequestDuration: meter.createHistogram('http.server.request.duration', {
      unit: 's',
      description: 'Duration of HTTP requests by route pattern',
      advice: { explicitBucketBoundaries: HTTP_DURATION_BUCKETS_S },
    }),
    jobRuns: meter.createCounter('financas_job_runs', {
      description: 'Scheduled job runs by outcome',
    }),
    jobLastSuccess: meter.createGauge('financas_job_last_success_timestamp_seconds', {
      description: 'When each job last finished without an error',
    }),
    appErrors: meter.createCounter('financas_app_errors', {
      description: 'Unexpected errors by code and module',
    }),
    notifications: meter.createCounter('financas_notifications', {
      description: 'Notification delivery attempts by channel, kind and outcome',
    }),
  }
}

export type AppMetrics = ReturnType<typeof createInstruments>

export function appMetrics(): AppMetrics {
  instruments ??= createInstruments(metrics.getMeter(METER_NAME))
  return instruments
}
