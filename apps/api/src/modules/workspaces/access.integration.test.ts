import { moduleActions } from '@api/modules/workspaces/access.table'
import { connectTestDatabases } from '@api/testing/database'
import { MODULE_ACTIONS } from '@financas/shared'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()

afterAll(() => databases.closeAll())

function asKeys(pairs: readonly { module: string; action: string }[]): string[] {
  return pairs.map(({ module, action }) => `${module}:${action}`).sort()
}

describe('module_actions', () => {
  it('matches the access matrix in @financas/shared exactly', async () => {
    const stored = await databases.app.select().from(moduleActions)
    expect(asKeys(stored)).toEqual(asKeys(MODULE_ACTIONS))
  })

  it('is read-only for the app role', async () => {
    const insertAsApp = databases.app
      .insert(moduleActions)
      .values({ module: 'reports', action: 'delete' })
    await expect(insertAsApp).rejects.toThrow()
  })
})
