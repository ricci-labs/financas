import type { Env } from '@api/core/config/env.schemas'
import type { AuditSource } from '@financas/shared'

export type LoggerEnv = Pick<Env, 'LOG_LEVEL' | 'NODE_ENV' | 'APP_VERSION'>

export type Operation = {
  traceId: string | null
  source: AuditSource
}
