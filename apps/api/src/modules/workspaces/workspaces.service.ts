import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { POSTGRES_CHECK_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import {
  generateWorkspaceId,
  insertDefaultSettings,
  insertWorkspace,
  selectCurrentSettings,
  selectCurrentWorkspace,
  selectSettings,
  updateSettings,
  updateWorkspaceName,
} from '@api/modules/workspaces/workspaces.repository'
import type {
  NewWorkspace,
  WorkspaceDefaults,
  WorkspaceRename,
  WorkspaceSettings,
  WorkspaceSummary,
} from '@api/modules/workspaces/workspaces.types'
import { workspaceNameSchema, workspaceSettingsChangeSchema } from '@financas/shared'

const SETTINGS_INVALID = 'SETTINGS_INVALID'

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

export async function renameWorkspace(
  db: Database,
  { workspaceId, name }: WorkspaceRename,
): Promise<void> {
  const parsedName = parseOrThrow(workspaceNameSchema, name, 'WORKSPACE_NAME_INVALID')
  const renamed = await withWorkspace(db, workspaceId, (tx) =>
    updateWorkspaceName(tx, workspaceId, parsedName),
  )
  if (!renamed) {
    throw new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
  }
}

export async function getWorkspaceSettings(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceSettings> {
  const settings = await withWorkspace(db, workspaceId, (tx) => selectSettings(tx))
  if (!settings) {
    throw new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
  }
  return settings
}

export async function changeWorkspaceSettings(
  db: Database,
  workspaceId: string,
  rawChange: unknown,
): Promise<WorkspaceSettings> {
  const change = parseOrThrow(workspaceSettingsChangeSchema, rawChange, SETTINGS_INVALID)
  const periodAnchorValue =
    change.periodAnchor === 'calendar_month' ? null : change.periodAnchorValue
  try {
    return await withWorkspace(db, workspaceId, async (tx) => {
      await updateSettings(tx, workspaceId, { ...change, periodAnchorValue })
      return selectCurrentSettingsOrFail(tx)
    })
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_CHECK_VIOLATION) {
      throw new ValidationError(SETTINGS_INVALID, 'These settings break a workspace rule', {
        cause: error,
      })
    }
    throw error
  }
}

async function selectCurrentSettingsOrFail(tx: WorkspaceTransaction): Promise<WorkspaceSettings> {
  const settings = await selectSettings(tx)
  if (!settings) {
    throw new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
  }
  return settings
}
