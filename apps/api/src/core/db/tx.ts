import type { Database } from '@api/core/db/client'
import { sql } from 'drizzle-orm'

export type WorkspaceTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export async function withWorkspace<T>(
  db: Database,
  workspaceId: string,
  work: (tx: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)
    return work(tx)
  })
}
