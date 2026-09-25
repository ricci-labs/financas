import { createDatabase, type Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import { sql } from 'drizzle-orm'

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

export async function switchWorkspaceMidTransaction(tx: WorkspaceTransaction, workspaceId: string) {
  await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
}

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

const BLOCKED_QUERIES_POLL_MS = 20
const BLOCKED_QUERIES_TIMEOUT_MS = 5000

async function countBlockedQueries(db: Database): Promise<number> {
  const result = await db.execute<{ blocked: number }>(
    sql`select count(*)::int as blocked from pg_locks where not granted`,
  )
  return result.rows[0]?.blocked ?? 0
}

export async function waitForBlockedQueries(db: Database, expected: number): Promise<void> {
  const deadline = Date.now() + BLOCKED_QUERIES_TIMEOUT_MS
  while ((await countBlockedQueries(db)) < expected) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${expected} blocked queries`)
    }
    await new Promise((resolve) => setTimeout(resolve, BLOCKED_QUERIES_POLL_MS))
  }
}
