import type { Database } from '@api/core/db/client'
import type { Permission, SystemRoleKey } from '@financas/shared'

export type SystemRoleIds = Record<SystemRoleKey, string>

export type WorkspaceAccessInput = {
  workspaceId: string
  userId: string
}

export type WorkspaceRole = {
  roleId: string
  name: string
  systemKey: SystemRoleKey | null
}

export type WorkspaceAccess = {
  workspace: { workspaceId: string; name: string; isArchived: boolean }
  membershipId: string
  role: WorkspaceRole
  permissions: Permission[]
}

export type AccessRouteDeps = {
  db: Database
}
