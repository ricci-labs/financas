import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { POSTGRES_CHECK_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import { auditCreation, audited } from '@api/modules/audit'
import {
  generateWorkspaceId,
  insertDefaultSettings,
  insertWorkspace,
  selectCurrentSettings,
  selectCurrentWorkspace,
  selectJobWorkspaceIds,
  selectSettings,
  settingsAuditTarget,
  updateSettings,
  updateWorkspaceName,
  workspaceAuditTarget,
} from '@api/modules/workspaces/workspaces.repository'
import type {
  NewWorkspace,
  WorkspaceDefaults,
  WorkspaceRename,
  WorkspaceSettings,
  WorkspaceSummary,
} from '@api/modules/workspaces/workspaces.types'
import {
  pixReceivingSchema,
  workspaceNameSchema,
  workspaceSettingsChangeSchema,
} from '@financas/shared'

const SETTINGS_INVALID = 'SETTINGS_INVALID'

export function reserveWorkspaceId(db: Database): Promise<string> {
  return generateWorkspaceId(db)
}

export async function addWorkspace(
  tx: WorkspaceTransaction,
  workspace: NewWorkspace,
): Promise<WorkspaceDefaults> {
  await insertWorkspace(tx, workspace)
  const defaults = await insertDefaultSettings(tx, workspace.id)
  await auditCreation(tx, workspaceAuditTarget(workspace.id))
  return defaults
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
    audited(tx, workspaceAuditTarget(workspaceId), 'update', () =>
      updateWorkspaceName(tx, workspaceId, parsedName),
    ),
  )
  if (!renamed) {
    throw new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
  }
}

export function listJobWorkspaceIds(db: Database): Promise<string[]> {
  return selectJobWorkspaceIds(db)
}

export async function currentWorkspaceSettings(
  tx: WorkspaceTransaction,
): Promise<WorkspaceSettings> {
  const settings = await selectSettings(tx)
  if (!settings) {
    throw new Error('The current workspace has no settings')
  }
  return settings
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
      await audited(tx, settingsAuditTarget(workspaceId), 'update', () =>
        updateSettings(tx, workspaceId, { ...change, periodAnchorValue }),
      )
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

export async function setPixReceiving(
  db: Database,
  workspaceId: string,
  rawInput: unknown,
): Promise<void> {
  const pix = parseOrThrow(pixReceivingSchema, rawInput, 'PIX_INVALID')
  await withWorkspace(db, workspaceId, (tx) =>
    audited(tx, settingsAuditTarget(workspaceId), 'update', () =>
      updateSettings(tx, workspaceId, {
        pixReceivingKey: pix?.key ?? null,
        pixReceiverName: pix?.receiverName ?? null,
        pixReceiverCity: pix?.receiverCity ?? null,
      }),
    ),
  )
}

async function selectCurrentSettingsOrFail(tx: WorkspaceTransaction): Promise<WorkspaceSettings> {
  const settings = await selectSettings(tx)
  if (!settings) {
    throw new NotFoundError('WORKSPACE_NOT_FOUND', 'Workspace not found')
  }
  return settings
}
