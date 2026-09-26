import { type Env, envSchema } from '@api/core/config/env.schemas'

const DEFAULT_PUBLIC_URL = 'http://localhost:5173'

export function publicUrlOf(env: Pick<Env, 'PUBLIC_URL'>): string {
  return env.PUBLIC_URL ?? DEFAULT_PUBLIC_URL
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (result.success) {
    return result.data
  }

  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  throw new Error(`Invalid environment: ${problems.join('; ')}`)
}
