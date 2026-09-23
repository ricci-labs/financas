import { withWorkspace } from '@api/core/db/tx'
import { roles } from '@api/modules/access/access.table'
import { users } from '@api/modules/identity/identity.table'
import { memberships } from '@api/modules/members/members.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const runId = crypto.randomUUID()

let userId: string
let workspaceA: string
let workspaceB: string
let roleA: string
let roleB: string

async function createUser(label: string): Promise<string> {
  const [user] = await databases.owner
    .insert(users)
    .values({ email: `${label}-${runId}@example.test`, displayName: label })
    .returning({ id: users.id })
  if (!user) {
    throw new Error(`Could not create user ${label}`)
  }
  return user.id
}

async function createRole(workspaceId: string): Promise<string> {
  const [role] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(roles).values({ workspaceId, name: 'Membro' }).returning({ id: roles.id }),
  )
  if (!role) {
    throw new Error('Could not create role')
  }
  return role.id
}

beforeAll(async () => {
  userId = await createUser('members')
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
  roleA = await createRole(workspaceA)
  roleB = await createRole(workspaceB)
})

afterAll(async () => {
  await databases.owner.delete(workspaces).where(eq(workspaces.createdByUserId, userId))
  await databases.owner.delete(users).where(like(users.email, `%${runId}%`))
  await databases.closeAll()
})

describe('memberships', () => {
  it('are isolated per workspace', async () => {
    await withWorkspace(databases.app, workspaceB, (tx) =>
      tx.insert(memberships).values({ workspaceId: workspaceB, userId, roleId: roleB }),
    )
    const visibleInA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(memberships),
    )
    expect(visibleInA).toEqual([])
  })

  it('allow one active membership per user and workspace', async () => {
    const twice = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(memberships).values([
        { workspaceId: workspaceA, userId, roleId: roleA },
        { workspaceId: workspaceA, userId, roleId: roleA },
      ]),
    )
    expect(await postgresErrorCodeOf(twice)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })

  it('allow the user back after the old membership was soft deleted', async () => {
    const active = await withWorkspace(databases.app, workspaceA, async (tx) => {
      await tx
        .insert(memberships)
        .values({ workspaceId: workspaceA, userId, roleId: roleA, deletedAt: new Date() })
      await tx.insert(memberships).values({ workspaceId: workspaceA, userId, roleId: roleA })
      return tx.select().from(memberships)
    })
    expect(active.filter((membership) => membership.deletedAt === null)).toHaveLength(1)
  })

  it('reject a role from another workspace', async () => {
    const newcomerId = await createUser('newcomer')
    const foreignRole = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(memberships).values({ workspaceId: workspaceA, userId: newcomerId, roleId: roleB }),
    )
    expect(await postgresErrorCodeOf(foreignRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('keep a role from being deleted while it is assigned', async () => {
    const deleteAssignedRole = withWorkspace(databases.app, workspaceB, (tx) =>
      tx.delete(roles).where(eq(roles.id, roleB)),
    )
    expect(await postgresErrorCodeOf(deleteAssignedRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })
})
