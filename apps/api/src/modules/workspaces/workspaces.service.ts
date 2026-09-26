import type { Database } from '@api/core/db/client'
import type { WorkspaceTransaction } from '@api/core/db/tx'
import {
  generateWorkspaceId,
  insertDefaultSettings,
  insertWorkspace,
  selectCurrentSettings,
  selectCurrentWorkspace,
} from '@api/modules/workspaces/workspaces.repository'
import type {
  NewWorkspace,
  WorkspaceDefaults,
  WorkspaceSummary,
} from '@api/modules/workspaces/workspaces.types'

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

export async function findCurrentWorkspace(
  tx: WorkspaceTransaction,
): Promise<WorkspaceSummary | undefined> {
  const workspace = await selectCurrentWorkspace(tx)
  if (!workspace) {
    return undefined
  }
  return {
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    isArchived: workspace.archivedAt !== null,
  }
}
