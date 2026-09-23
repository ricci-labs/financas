import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

const LOCAL_ENV_FILE = '../../.env'

if (existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE)
}

const migrationUrl = process.env.DATABASE_MIGRATION_URL
if (!migrationUrl) {
  throw new Error('DATABASE_MIGRATION_URL is required to generate or run migrations')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/**/*.table.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
})
