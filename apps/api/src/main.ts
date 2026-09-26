import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import { loadEnv, publicUrlOf } from '@api/core/config/env'
import { createDatabase } from '@api/core/db/client'
import { createMailer } from '@api/core/email/mailer'
import { sessionCookieSettings } from '@api/core/http/session-cookie'
import { createLogger } from '@api/core/observability/logger'
import { createAccountEmailLimits, createLoginLimits } from '@api/modules/identity'
import { serve } from '@hono/node-server'

const SHUTDOWN_TIMEOUT_MS = 10_000

const env = loadEnv()
const logger = createLogger(env)
const database = createDatabase(env.DATABASE_URL, {
  onConnectionError: (err) => {
    logger.warn({ event: 'db.connection.lost', err }, 'Idle database connection lost')
  },
})
const background = createBackgroundTasks()
const app = createApp({
  version: env.APP_VERSION,
  startedAt: Date.now(),
  isDatabaseReachable: database.isReachable,
  logger,
  db: database.db,
  mailer: createMailer(env, logger.child({ module: 'email' })),
  publicUrl: publicUrlOf(env),
  isPublicSignupEnabled: env.PUBLIC_SIGNUP_ENABLED,
  cookie: sessionCookieSettings(env.NODE_ENV),
  loginLimits: createLoginLimits({
    maxFailuresPerEmail: env.LOGIN_MAX_FAILURES_PER_EMAIL,
    maxFailuresPerClient: env.LOGIN_MAX_FAILURES_PER_IP,
    windowMinutes: env.LOGIN_FAILURE_WINDOW_MINUTES,
  }),
  accountEmailLimits: createAccountEmailLimits({
    maxPerEmailPerHour: env.ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR,
    maxPerClientPerHour: env.ACCOUNT_EMAILS_PER_IP_PER_HOUR,
    maxInvalidLinksPerClientPerHour: env.INVALID_LINKS_PER_IP_PER_HOUR,
  }),
  trustedProxyHops: env.TRUSTED_PROXY_HOPS,
  background,
})

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ event: 'app.started', port: info.port }, 'API listening')
})

function shutdown(signal: NodeJS.Signals) {
  logger.info({ event: 'app.stopping', signal }, 'Shutting down')
  server.close(async () => {
    await background.idle()
    await database.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
