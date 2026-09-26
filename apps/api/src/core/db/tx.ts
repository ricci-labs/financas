import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { sql } from 'drizzle-orm'

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
