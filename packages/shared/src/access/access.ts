import {
  APP_MODULES,
  type AppModule,
  type PermissionAction,
  SYSTEM_ROLE_KEYS,
  type SystemRoleKey,
} from '@shared/access/access.constants'
import type { Permission, RoleTemplate } from '@shared/access/access.types'

const FULL_ACCESS = 'vcud'
const READ_ONLY = 'v'
const NO_ACCESS = ''

const ACTION_BY_LETTER: Record<string, PermissionAction> = {
  v: 'view',
  c: 'create',
  u: 'update',
  d: 'delete',
}

const VALID_ACTIONS_BY_MODULE: Record<AppModule, string> = {
  entries: FULL_ACCESS,
  accounts: FULL_ACCESS,
  cards: FULL_ACCESS,
  contacts: FULL_ACCESS,
  planning: FULL_ACCESS,
  budgets: FULL_ACCESS,
  reports: READ_ONLY,
  attachments: FULL_ACCESS,
  settings: 'vu',
  members: FULL_ACCESS,
  audit: READ_ONLY,
}

const DEFAULT_MATRIX: Record<SystemRoleKey, Record<AppModule, string>> = {
  owner: {
    entries: 'vcud',
    accounts: 'vcud',
    cards: 'vcud',
    contacts: 'vcud',
    planning: 'vcud',
    budgets: 'vcud',
    reports: 'v',
    attachments: 'vcud',
    settings: 'vu',
    members: 'vcud',
    audit: 'v',
  },
  admin: {
    entries: 'vcud',
    accounts: 'vcud',
    cards: 'vcud',
    contacts: 'vcud',
    planning: 'vcud',
    budgets: 'vcud',
    reports: 'v',
    attachments: 'vcud',
    settings: 'vu',
    members: 'vcu',
    audit: 'v',
  },
  member: {
    entries: 'vcud',
    accounts: 'v',
    cards: 'vcu',
    contacts: 'vcu',
    planning: 'vcu',
    budgets: 'v',
    reports: 'v',
    attachments: 'vcu',
    settings: 'v',
    members: 'v',
    audit: NO_ACCESS,
  },
  viewer: {
    entries: 'v',
    accounts: 'v',
    cards: 'v',
    contacts: 'v',
    planning: 'v',
    budgets: 'v',
    reports: 'v',
    attachments: 'v',
    settings: NO_ACCESS,
    members: NO_ACCESS,
    audit: NO_ACCESS,
  },
}

const ROLE_NAMES: Record<SystemRoleKey, string> = {
  owner: 'Dono',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Leitor',
}

export const MODULE_ACTIONS: readonly Permission[] = expandMatrix(VALID_ACTIONS_BY_MODULE)

export const ROLE_TEMPLATES: readonly RoleTemplate[] = SYSTEM_ROLE_KEYS.map((key) => ({
  key,
  name: ROLE_NAMES[key],
  permissions: expandMatrix(DEFAULT_MATRIX[key]),
}))

export function isValidPermission({ module, action }: Permission): boolean {
  return MODULE_ACTIONS.some((valid) => valid.module === module && valid.action === action)
}

export function can(
  permissions: readonly Permission[],
  module: AppModule,
  action: PermissionAction,
): boolean {
  return permissions.some((granted) => granted.module === module && granted.action === action)
}

export function missingViewPermissions(permissions: readonly Permission[]): Permission[] {
  const modulesNeedingView = new Set(
    permissions.filter((granted) => granted.action !== 'view').map((granted) => granted.module),
  )
  return [...modulesNeedingView]
    .filter((module) => !can(permissions, module, 'view'))
    .map((module) => ({ module, action: 'view' as const }))
}

function expandMatrix(matrix: Record<AppModule, string>): Permission[] {
  return APP_MODULES.flatMap((module) =>
    [...matrix[module]].map((letter) => ({ module, action: toAction(letter) })),
  )
}

function toAction(letter: string): PermissionAction {
  const action = ACTION_BY_LETTER[letter]
  if (!action) {
    throw new RangeError(`Unknown permission letter: ${letter}`)
  }
  return action
}
