export const APP_MODULES = [
  'entries',
  'accounts',
  'cards',
  'contacts',
  'planning',
  'budgets',
  'reports',
  'attachments',
  'settings',
  'members',
  'audit',
] as const

export type AppModule = (typeof APP_MODULES)[number]

export const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete'] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export const SYSTEM_ROLE_KEYS = ['owner', 'admin', 'member', 'viewer'] as const

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number]
