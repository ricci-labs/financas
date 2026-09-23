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
