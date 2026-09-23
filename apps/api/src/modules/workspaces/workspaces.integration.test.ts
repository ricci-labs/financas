import { withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { rolePermissions, roles } from '@api/modules/access/access.table'
import { users } from '@api/modules/identity/identity.table'
import { memberships } from '@api/modules/members/members.table'
import { createWorkspace } from '@api/modules/workspaces'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { ROLE_TEMPLATES } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const runId = crypto.randomUUID()

let workspaceA: string
let workspaceB: string
let ownerUserId: string

beforeAll(async () => {
  const [user] = await databases.owner
    .insert(users)
    .values({ email: `rls-${runId}@example.test`, displayName: 'RLS test' })
    .returning({ id: users.id })
  if (!user) {
    throw new Error('Could not create the test user')
  }
  ownerUserId = user.id

  const created = await databases.owner
    .insert(workspaces)
    .values([
      { name: `A ${runId}`, createdByUserId: ownerUserId },
      { name: `B ${runId}`, createdByUserId: ownerUserId },
    ])
    .returning({ id: workspaces.id })
  const [first, second] = created
  if (!first || !second) {
    throw new Error('Could not create the test workspaces')
  }
  workspaceA = first.id
  workspaceB = second.id
})

afterAll(async () => {
  await databases.owner.delete(workspaces).where(eq(workspaces.createdByUserId, ownerUserId))
  await databases.owner.delete(users).where(eq(users.id, ownerUserId))
  await databases.closeAll()
})

describe('workspace isolation (RLS)', () => {
  it('shows no workspace at all when no workspace is set', async () => {
    const visible = await databases.app.select().from(workspaces)
    expect(visible).toEqual([])
  })

  it('shows only the current workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: workspaces.id }).from(workspaces),
    )
    expect(visible).toEqual([{ id: workspaceA }])
  })

  it('cannot update another workspace', async () => {
    const updated = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(workspaces)
        .set({ name: 'hijacked' })
        .where(eq(workspaces.id, workspaceB))
        .returning({ id: workspaces.id }),
    )
    expect(updated).toEqual([])

    const [untouched] = await databases.owner
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceB))
    expect(untouched?.name).toBe(`B ${runId}`)
  })

  it('cannot insert a row for another workspace', async () => {
    const insertIntoOtherWorkspace = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(workspaces).values({ name: 'intruder', createdByUserId: ownerUserId }),
    )
    expect(await postgresErrorCodeOf(insertIntoOtherWorkspace)).toBe(
      POSTGRES_ERRORS.rowLevelSecurityViolation,
    )
  })

  it('does not leak the workspace setting after the transaction ends', async () => {
    await withWorkspace(databases.app, workspaceA, (tx) => tx.select().from(workspaces))
    const visibleAfterwards = await databases.app.select().from(workspaces)
    expect(visibleAfterwards).toEqual([])
  })
})

describe('createWorkspace', () => {
  function permissionKeys(permissions: readonly { module: string; action: string }[]): string[] {
    return permissions.map(({ module, action }) => `${module}:${action}`).sort()
  }

  it('creates the workspace, the four system roles with their matrix and the owner membership', async () => {
    const { workspaceId, ownerMembershipId } = await createWorkspace(databases.app, {
      name: `  Casa ${runId}  `,
      ownerUserId,
    })

    const created = await withWorkspace(databases.app, workspaceId, async (tx) => ({
      workspace: await tx.select().from(workspaces),
      roles: await tx.select().from(roles),
      permissions: await tx.select().from(rolePermissions),
      memberships: await tx.select().from(memberships),
    }))

    expect(created.workspace).toMatchObject([{ id: workspaceId, name: `Casa ${runId}` }])
    expect(created.roles.map((role) => role.systemKey).sort()).toEqual([
      'admin',
      'member',
      'owner',
      'viewer',
    ])

    for (const template of ROLE_TEMPLATES) {
      const role = created.roles.find((candidate) => candidate.systemKey === template.key)
      const granted = created.permissions.filter((permission) => permission.roleId === role?.id)
      expect(permissionKeys(granted)).toEqual(permissionKeys(template.permissions))
    }

    const ownerRole = created.roles.find((role) => role.systemKey === 'owner')
    expect(created.memberships).toMatchObject([
      { id: ownerMembershipId, userId: ownerUserId, roleId: ownerRole?.id },
    ])
  })

  it('keeps the new workspace invisible from another workspace', async () => {
    const { workspaceId } = await createWorkspace(databases.app, {
      name: `Pessoal ${runId}`,
      ownerUserId,
    })
    const seenFromA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: roles.id }).from(roles).where(eq(roles.workspaceId, workspaceId)),
    )
    expect(seenFromA).toEqual([])
  })

  it('rejects a blank name before touching the database', async () => {
    const blankName = createWorkspace(databases.app, { name: '   ', ownerUserId })
    await expect(blankName).rejects.toBeInstanceOf(ValidationError)
  })
})
