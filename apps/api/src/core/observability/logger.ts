import type { LoggerEnv } from '@api/core/observability/observability.types'
import { type DestinationStream, pino } from 'pino'

const SECRET_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'tokenHash',
  'apiKey',
  'phone',
  'jid',
]

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SECRET_FIELDS,
  ...SECRET_FIELDS.map((field) => `*.${field}`),
]

export function createLogger(env: LoggerEnv, destination?: DestinationStream) {
  const usePrettyOutput = env.NODE_ENV === 'development' && process.stdout.isTTY

  const options = {
    level: env.LOG_LEVEL,
    base: { service: 'financas-api', version: env.APP_VERSION, env: env.NODE_ENV },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    ...(usePrettyOutput && {
      transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
    }),
  }
  return destination ? pino(options, destination) : pino(options)
}

export type Logger = ReturnType<typeof createLogger>
