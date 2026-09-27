import { metrics } from '@opentelemetry/api'
import { PrometheusExporter, PrometheusSerializer } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics'

const NO_PREFIX = ''
const WITHOUT_TIMESTAMPS = false
const NO_RESOURCE_LABELS = undefined
const WITH_TARGET_INFO = false
const WITHOUT_SCOPE_INFO = true

export function captureMetrics() {
  const exporter = new PrometheusExporter({ preventServerStart: true })
  metrics.disable()
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [exporter] }))
  const serializer = new PrometheusSerializer(
    NO_PREFIX,
    WITHOUT_TIMESTAMPS,
    NO_RESOURCE_LABELS,
    WITH_TARGET_INFO,
    WITHOUT_SCOPE_INFO,
  )
  return {
    scrape: async () => serializer.serialize((await exporter.collect()).resourceMetrics),
  }
}
