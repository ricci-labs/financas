import { fileURLToPath } from 'node:url'
import { loadMigrationEnv } from '@api/core/config/env'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))
const FAILURE_EXIT_CODE = 1

const { DATABASE_MIGRATION_URL } = loadMigrationEnv()
const pool = new Pool({ connectionString: DATABASE_MIGRATION_URL, max: 1 })

try {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER })
  process.stdout.write('Migrations are up to date.\n')
} catch (error) {
  process.exitCode = FAILURE_EXIT_CODE
  process.stderr.write(`Migrations failed: ${error instanceof Error ? error.message : error}\n`)
} finally {
  await pool.end()
}
