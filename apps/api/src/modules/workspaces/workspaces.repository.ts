import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { sql } from 'drizzle-orm'

type NewWorkspace = {
  id: string
  name: string
  createdByUserId: string
}

export async function reserveWorkspaceId(db: Database): Promise<string> {
  const result = await db.execute<{ id: string }>(sql`select uuidv7() as id`)
  const reserved = result.rows[0]
  if (!reserved) {
    throw new Error('Could not reserve a workspace id')
  }
  return reserved.id
}

export async function insertWorkspace(tx: WorkspaceTransaction, workspace: NewWorkspace) {
  await tx.insert(workspaces).values(workspace)
}
