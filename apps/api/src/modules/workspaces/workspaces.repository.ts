import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import { workspaceSettings, workspaces } from '@api/modules/workspaces/workspaces.table'
import type { NewWorkspace } from '@api/modules/workspaces/workspaces.types'
import { sql } from 'drizzle-orm'

export async function generateWorkspaceId(db: Database): Promise<string> {
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

export async function insertDefaultSettings(tx: WorkspaceTransaction, workspaceId: string) {
  const [settings] = await tx
    .insert(workspaceSettings)
    .values({ workspaceId })
    .returning({ currency: workspaceSettings.currency })
  if (!settings) {
    throw new Error(`Settings of workspace ${workspaceId} were not inserted`)
  }
  return settings
}

export async function selectCurrentSettings(tx: WorkspaceTransaction) {
  const [settings] = await tx
    .select({ currency: workspaceSettings.currency })
    .from(workspaceSettings)
  if (!settings) {
    throw new Error('The current workspace has no settings')
  }
  return settings
}
