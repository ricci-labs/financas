import { sql } from 'drizzle-orm'
import { type AnyPgColumn, pgPolicy, pgRole } from 'drizzle-orm/pg-core'

export const appRole = pgRole('financas_app').existing()

export const currentWorkspaceId = sql`app_current_workspace_id()`

export function tenantIsolation(tableName: string, workspaceColumn: AnyPgColumn) {
  const belongsToCurrentWorkspace = sql`${workspaceColumn} = ${currentWorkspaceId}`
  return pgPolicy(`${tableName}_tenant_isolation`, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: belongsToCurrentWorkspace,
    withCheck: belongsToCurrentWorkspace,
  })
}
