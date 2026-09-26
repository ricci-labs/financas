import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

export type Database = NodePgDatabase<Record<string, never>> & { $client: Pool }

export type DatabaseOptions = {
  onConnectionError: (error: Error) => void
}

export type PostgresErrorField = 'code' | 'constraint'

export type WorkspaceTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
