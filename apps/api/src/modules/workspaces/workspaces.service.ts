import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import {
  generateWorkspaceId,
  insertDefaultSettings,
  insertWorkspace,
  selectCurrentSettings,
} from '@api/modules/workspaces/workspaces.repository'
import type { NewWorkspace, WorkspaceDefaults } from '@api/modules/workspaces/workspaces.types'

export function reserveWorkspaceId(db: Database): Promise<string> {
  return generateWorkspaceId(db)
}

export async function addWorkspace(
  tx: WorkspaceTransaction,
  workspace: NewWorkspace,
): Promise<WorkspaceDefaults> {
  await insertWorkspace(tx, workspace)
  return insertDefaultSettings(tx, workspace.id)
}

export function currentWorkspaceDefaults(tx: WorkspaceTransaction): Promise<WorkspaceDefaults> {
  return selectCurrentSettings(tx)
}
