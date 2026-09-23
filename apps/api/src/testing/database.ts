import { createDatabase } from '@api/core/db/client'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is required for integration tests (run pnpm db:up and copy .env.example)`,
    )
  }
  return value
}

export function connectTestDatabases() {
  const failOnConnectionError = (error: Error) => {
    throw error
  }
  const app = createDatabase(requiredEnv('DATABASE_URL'), {
    onConnectionError: failOnConnectionError,
  })
  const owner = createDatabase(requiredEnv('DATABASE_MIGRATION_URL'), {
    onConnectionError: failOnConnectionError,
  })

  return {
    app: app.db,
    owner: owner.db,
    closeAll: () => Promise.all([app.close(), owner.close()]),
  }
}

export const POSTGRES_ERRORS = {
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
  checkViolation: '23514',
  insufficientPrivilege: '42501',
  rowLevelSecurityViolation: '42501',
} as const

function findPostgresCode(error: unknown): string | undefined {
  let current: unknown = error
  while (current instanceof Error) {
    const code = (current as Error & { code?: unknown }).code
    if (typeof code === 'string') {
      return code
    }
    current = current.cause
  }
  return undefined
}

export async function postgresErrorCodeOf(
  operation: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await operation
    return undefined
  } catch (error) {
    return findPostgresCode(error)
  }
}
