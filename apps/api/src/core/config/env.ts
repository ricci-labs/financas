import {
  type Env,
  envSchema,
  type MigrationEnv,
  migrationEnvSchema,
} from '@api/core/config/env.schemas'
import type { z } from 'zod'

const DEFAULT_PUBLIC_URL = 'http://localhost:5173'

export function publicUrlOf(env: Pick<Env, 'PUBLIC_URL'>): string {
  return env.PUBLIC_URL ?? DEFAULT_PUBLIC_URL
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseEnv(envSchema, source)
}

export function loadMigrationEnv(source: NodeJS.ProcessEnv = process.env): MigrationEnv {
  return parseEnv(migrationEnvSchema, source)
}

function parseEnv<T>(schema: z.ZodType<T>, source: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(source)
  if (result.success) {
    return result.data
  }

  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  throw new Error(`Invalid environment: ${problems.join('; ')}`)
}
