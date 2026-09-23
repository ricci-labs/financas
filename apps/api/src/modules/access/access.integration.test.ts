import { withWorkspace } from '@api/core/db/tx'
import { moduleActions, rolePermissions, roles } from '@api/modules/access/access.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { MODULE_ACTIONS } from '@financas/shared'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let workspaceA: string
let workspaceB: string
let roleA: string
let roleB: string

async function createCustomRole(workspaceId: string): Promise<string> {
  const [role] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(roles).values({ workspaceId, name: 'Lançador' }).returning({ id: roles.id }),
  )
  if (!role) {
    throw new Error('Could not create the custom role')
  }
  return role.id
}

function asKeys(pairs: readonly { module: string; action: string }[]): string[] {
  return pairs.map(({ module, action }) => `${module}:${action}`).sort()
}

beforeAll(async () => {
  const ownerUserId = await fixtures.createUser('access')
  workspaceA = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'A')).workspaceId
  workspaceB = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'B')).workspaceId
  roleA = await createCustomRole(workspaceA)
  roleB = await createCustomRole(workspaceB)
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

describe('module_actions', () => {
  it('matches the access matrix in @financas/shared exactly', async () => {
    const stored = await databases.app.select().from(moduleActions)
    expect(asKeys(stored)).toEqual(asKeys(MODULE_ACTIONS))
  })

  it('is read-only for the app role', async () => {
    const insertAsApp = databases.app
      .insert(moduleActions)
      .values({ module: 'reports', action: 'delete' })
    expect(await postgresErrorCodeOf(insertAsApp)).toBe(POSTGRES_ERRORS.insufficientPrivilege)
  })
})

describe('roles', () => {
  it('are isolated per workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: roles.id, workspaceId: roles.workspaceId }).from(roles),
    )
    expect(visible.every((role) => role.workspaceId === workspaceA)).toBe(true)
    expect(visible.map((role) => role.id)).toContain(roleA)
    expect(visible.map((role) => role.id)).not.toContain(roleB)
  })

  it('allow only one role per system key in a workspace', async () => {
    const secondOwner = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(roles).values({ workspaceId: workspaceA, name: 'Outro dono', systemKey: 'owner' }),
    )
    expect(await postgresErrorCodeOf(secondOwner)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })
})

describe('role permissions', () => {
  it('accept an action together with view, in any order', async () => {
    const granted = await withWorkspace(databases.app, workspaceA, async (tx) => {
      await tx.insert(rolePermissions).values([
        { workspaceId: workspaceA, roleId: roleA, module: 'entries', action: 'create' },
        { workspaceId: workspaceA, roleId: roleA, module: 'entries', action: 'view' },
      ])
      return tx.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleA))
    })
    expect(granted).toHaveLength(2)
  })

  it('reject an action without view on that module', async () => {
    const createWithoutView = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .insert(rolePermissions)
        .values({ workspaceId: workspaceA, roleId: roleA, module: 'cards', action: 'create' }),
    )
    expect(await postgresErrorCodeOf(createWithoutView)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('reject removing view while other actions remain, but allow removing them all', async () => {
    const removeOnlyView = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleA), eq(rolePermissions.action, 'view'))),
    )
    expect(await postgresErrorCodeOf(removeOnlyView)).toBe(POSTGRES_ERRORS.checkViolation)

    const removeEverything = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleA)),
    )
    expect(await postgresErrorCodeOf(removeEverything)).toBeUndefined()
  })

  it('reject a module-action pair that does not exist', async () => {
    const deleteReports = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .insert(rolePermissions)
        .values({ workspaceId: workspaceA, roleId: roleA, module: 'reports', action: 'delete' }),
    )
    expect(await postgresErrorCodeOf(deleteReports)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('reject a role from another workspace', async () => {
    const borrowForeignRole = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .insert(rolePermissions)
        .values({ workspaceId: workspaceA, roleId: roleB, module: 'entries', action: 'view' }),
    )
    expect(await postgresErrorCodeOf(borrowForeignRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })
})
