import type { Env } from '@api/core/config/env.schemas'

export type LoggerEnv = Pick<Env, 'LOG_LEVEL' | 'NODE_ENV' | 'APP_VERSION'>
