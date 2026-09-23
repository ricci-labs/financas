import { sql } from 'drizzle-orm'
import { pgRole } from 'drizzle-orm/pg-core'

export const appRole = pgRole('financas_app').existing()

export const currentWorkspaceId = sql`app_current_workspace_id()`
