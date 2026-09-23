import type { Env } from '@api/core/config/env'
import { pino } from 'pino'

type LoggerEnv = Pick<Env, 'LOG_LEVEL' | 'NODE_ENV' | 'APP_VERSION'>

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.token',
  '*.apiKey',
  '*.password',
  '*.phone',
  '*.jid',
]

export function createLogger(env: LoggerEnv) {
  const usePrettyOutput = env.NODE_ENV === 'development' && process.stdout.isTTY

  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'financas-api', version: env.APP_VERSION, env: env.NODE_ENV },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    ...(usePrettyOutput && {
      transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
    }),
  })
}

export type Logger = ReturnType<typeof createLogger>
