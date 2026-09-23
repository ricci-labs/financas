import {
  can,
  isValidPermission,
  MODULE_ACTIONS,
  missingViewPermissions,
  ROLE_TEMPLATES,
} from '@shared/access/access'
import type { SystemRoleKey } from '@shared/access/access.constants'
import type { RoleTemplate } from '@shared/access/access.types'
import { describe, expect, it } from 'vitest'

function template(key: SystemRoleKey): RoleTemplate {
  const found = ROLE_TEMPLATES.find((role) => role.key === key)
  if (!found) {
    throw new Error(`Missing role template: ${key}`)
  }
  return found
}

describe('module actions', () => {
  it('reports and audit are view only; settings has no create or delete', () => {
    expect(isValidPermission({ module: 'reports', action: 'create' })).toBe(false)
    expect(isValidPermission({ module: 'audit', action: 'delete' })).toBe(false)
    expect(isValidPermission({ module: 'settings', action: 'update' })).toBe(true)
    expect(isValidPermission({ module: 'settings', action: 'create' })).toBe(false)
  })

  it('has one entry per valid pair', () => {
    const keys = MODULE_ACTIONS.map(({ module, action }) => `${module}:${action}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(36)
  })
})

describe('role templates', () => {
  it.each(ROLE_TEMPLATES.map((role) => [role.key, role]))(
    '%s only grants valid permissions and always includes view',
    (_key, role) => {
      expect(role.permissions.every(isValidPermission)).toBe(true)
      expect(missingViewPermissions(role.permissions)).toEqual([])
    },
  )

  it('owner has every valid permission', () => {
    expect(template('owner').permissions).toHaveLength(MODULE_ACTIONS.length)
  })

  it('admin manages members but cannot remove them', () => {
    const admin = template('admin').permissions
    expect(can(admin, 'members', 'update')).toBe(true)
    expect(can(admin, 'members', 'delete')).toBe(false)
  })

  it('member records and deletes entries but cannot touch accounts or see the audit log', () => {
    const member = template('member').permissions
    expect(can(member, 'entries', 'delete')).toBe(true)
    expect(can(member, 'accounts', 'create')).toBe(false)
    expect(can(member, 'audit', 'view')).toBe(false)
  })

  it('viewer only views, and not settings, members or audit', () => {
    const viewer = template('viewer').permissions
    expect(viewer.every((granted) => granted.action === 'view')).toBe(true)
    expect(can(viewer, 'settings', 'view')).toBe(false)
    expect(can(viewer, 'members', 'view')).toBe(false)
  })
})

describe('missingViewPermissions', () => {
  it('lists modules granted without view', () => {
    expect(
      missingViewPermissions([
        { module: 'entries', action: 'create' },
        { module: 'cards', action: 'view' },
        { module: 'cards', action: 'update' },
      ]),
    ).toEqual([{ module: 'entries', action: 'view' }])
  })
})
