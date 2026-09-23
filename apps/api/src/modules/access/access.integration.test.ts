import { withWorkspace } from '@api/core/db/tx'
import { moduleActions, rolePermissions, roles } from '@api/modules/access/access.table'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { MODULE_ACTIONS } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const runId = crypto.randomUUID()

let userId: string
let workspaceA: string
let workspaceB: string
let roleA: string
let roleB: string

async function createRole(workspaceId: string, name: string): Promise<string> {
  const [role] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(roles).values({ workspaceId, name }).returning({ id: roles.id }),
  )
  if (!role) {
    throw new Error(`Could not create role ${name}`)
  }
  return role.id
}

beforeAll(async () => {
  const [user] = await databases.owner
    .insert(users)
    .values({ email: `roles-${runId}@example.test`, displayName: 'Roles test' })
    .returning({ id: users.id })
  if (!user) {
    throw new Error('Could not create the test user')
  }
  userId = user.id

  const [first, second] = await databases.owner
    .insert(workspaces)
    .values([
      { name: `A ${runId}`, createdByUserId: userId },
      { name: `B ${runId}`, createdByUserId: userId },
    ])
    .returning({ id: workspaces.id })
  if (!first || !second) {
    throw new Error('Could not create the test workspaces')
  }
  workspaceA = first.id
  workspaceB = second.id
  roleA = await createRole(workspaceA, 'Lançador')
  roleB = await createRole(workspaceB, 'Lançador')
})

afterAll(async () => {
  await databases.owner.delete(workspaces).where(eq(workspaces.createdByUserId, userId))
  await databases.owner.delete(users).where(eq(users.id, userId))
  await databases.closeAll()
})

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
    expect(await postgresErrorCodeOf(insertAsApp)).toBe(POSTGRES_ERRORS.insufficientPrivilege)
  })
})

describe('roles', () => {
  it('are isolated per workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: roles.id }).from(roles),
    )
    expect(visible).toEqual([{ id: roleA }])
  })

  it('allow only one role per system key in a workspace', async () => {
    const twoOwners = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(roles).values([
        { workspaceId: workspaceA, name: 'Dono', systemKey: 'owner' },
        { workspaceId: workspaceA, name: 'Outro dono', systemKey: 'owner' },
      ]),
    )
    expect(await postgresErrorCodeOf(twoOwners)).toBe(POSTGRES_ERRORS.uniqueViolation)
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

  it('reject removing view while other actions remain', async () => {
    const removeView = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.action, 'view'))
        .returning({ module: rolePermissions.module }),
    )
    expect(await postgresErrorCodeOf(removeView)).toBe(POSTGRES_ERRORS.checkViolation)
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
