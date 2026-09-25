import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import {
  generateWorkspaceId,
  insertDefaultSettings,
  insertWorkspace,
} from '@api/modules/workspaces/workspaces.repository'
import type { NewWorkspace } from '@api/modules/workspaces/workspaces.types'

export function reserveWorkspaceId(db: Database): Promise<string> {
  return generateWorkspaceId(db)
}

export async function addWorkspace(tx: WorkspaceTransaction, workspace: NewWorkspace) {
  await insertWorkspace(tx, workspace)
  await insertDefaultSettings(tx, workspace.id)
}
