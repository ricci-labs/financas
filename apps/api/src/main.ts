import { createApp } from '@api/app'
import { loadEnv } from '@api/core/config/env'
import { createLogger } from '@api/core/observability/logger'
import { serve } from '@hono/node-server'

const SHUTDOWN_TIMEOUT_MS = 10_000

const env = loadEnv()
const logger = createLogger(env)
const app = createApp({ version: env.APP_VERSION, startedAt: Date.now() })

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ event: 'app.started', port: info.port }, 'API listening')
})

function shutdown(signal: NodeJS.Signals) {
  logger.info({ event: 'app.stopping', signal }, 'Shutting down')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
