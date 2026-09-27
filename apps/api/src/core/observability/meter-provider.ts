import type { Env } from '@api/core/config/env.schemas'
import { metrics } from '@opentelemetry/api'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { MeterProvider } from '@opentelemetry/sdk-metrics'

export function startMetrics(env: Env): MeterProvider | undefined {
  if (env.OTEL_METRICS_EXPORTER !== 'prometheus') {
    return undefined
  }
  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': env.OTEL_SERVICE_NAME,
      'service.version': env.APP_VERSION,
    }),
    readers: [
      new PrometheusExporter({
        host: env.OTEL_EXPORTER_PROMETHEUS_HOST,
        port: env.OTEL_EXPORTER_PROMETHEUS_PORT,
        withoutScopeInfo: true,
      }),
    ],
  })
  metrics.setGlobalMeterProvider(provider)
  return provider
}
