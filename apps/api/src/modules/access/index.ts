export {
  authorize,
  authorizeAnyMember,
  currentWorkspace,
  isPermissionCheck,
  workspaceAccess,
} from '@api/modules/access/access.middleware'
export {
  changeMemberRole,
  createSystemRoles,
  findRole,
  listMembers,
  listWorkspacesOfUser,
  loadWorkspaceAccess,
  removeMember,
} from '@api/modules/access/access.service'
export type {
  AccessRouteDeps,
  MemberItem,
  RoleRef,
  SystemRoleIds,
  WorkspaceAccess,
  WorkspaceListItem,
} from '@api/modules/access/access.types'
