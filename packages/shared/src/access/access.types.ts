import type { AppModule, PermissionAction, SystemRoleKey } from '@shared/access/access.constants'

export type Permission = {
  module: AppModule
  action: PermissionAction
}

export type RoleTemplate = {
  key: SystemRoleKey
  name: string
  permissions: readonly Permission[]
}
