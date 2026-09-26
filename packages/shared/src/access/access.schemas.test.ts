import { newRoleSchema } from '@shared/access/access.schemas'
import { describe, expect, it } from 'vitest'

describe('newRoleSchema', () => {
  it('accepts a role whose actions come with view, dropping repeated permissions', () => {
    const role = newRoleSchema.parse({
      name: ' Lançador ',
      permissions: [
        { module: 'entries', action: 'view' },
        { module: 'entries', action: 'create' },
        { module: 'entries', action: 'create' },
      ],
    })
    expect(role).toEqual({
      name: 'Lançador',
      permissions: [
        { module: 'entries', action: 'view' },
        { module: 'entries', action: 'create' },
      ],
    })
  })

  it('refuses an action without view and a pair that does not exist', () => {
    const withoutView = { name: 'X', permissions: [{ module: 'entries', action: 'create' }] }
    const reportsCreate = {
      name: 'Y',
      permissions: [
        { module: 'reports', action: 'view' },
        { module: 'reports', action: 'create' },
      ],
    }
    expect(newRoleSchema.safeParse(withoutView).success).toBe(false)
    expect(newRoleSchema.safeParse(reportsCreate).success).toBe(false)
  })
})
