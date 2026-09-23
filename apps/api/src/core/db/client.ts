import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const HEALTH_CHECK_TIMEOUT_MS = 2000

type DatabaseOptions = {
  onConnectionError: (error: Error) => void
}

export function createDatabase(connectionString: string, { onConnectionError }: DatabaseOptions) {
  const pool = new Pool({ connectionString })
  pool.on('error', onConnectionError)

  const db = drizzle(pool, { casing: 'snake_case' })

  async function isReachable(): Promise<boolean> {
    const timeout = new Promise<false>((resolve) => {
      setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS).unref()
    })
    const query = db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false)
    return Promise.race([query, timeout])
  }

  return {
    db,
    isReachable,
    close: () => pool.end(),
  }
}

export type Database = ReturnType<typeof createDatabase>['db']
