import type { Database } from '@api/core/db/db.types'
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

export type NewSystemRole = {
  workspaceId: string
  name: string
  systemKey: SystemRoleKey
}

export type WorkspaceListItem = {
  workspaceId: string
  name: string
  isArchived: boolean
  role: WorkspaceRole
}

export type RoleRef = {
  workspaceId: string
  roleId: string
}

export type MemberItem = {
  membershipId: string
  userId: string
  displayName: string
  email: string
  role: WorkspaceRole
  joinedAt: Date
}

export type MemberActor = {
  workspaceId: string
  userId: string
  roleKey: SystemRoleKey | null
}

export type ChangeMemberRoleInput = {
  actor: MemberActor
  membershipId: string
  roleId: string
}

export type RemoveMemberInput = {
  actor: MemberActor
  membershipId: string
  reason?: string
}
