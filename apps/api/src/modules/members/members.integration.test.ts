import { withWorkspace } from '@api/core/db/tx'
import { roles } from '@api/modules/access/access.table'
import { addMember } from '@api/modules/members'
import { membershipPreferences, memberships } from '@api/modules/members/members.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import type { SystemRoleKey } from '@financas/shared'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let creatorId: string
let workspaceA: string
let workspaceB: string

async function systemRoleId(workspaceId: string, key: SystemRoleKey): Promise<string> {
  const [role] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx.select({ id: roles.id }).from(roles).where(eq(roles.systemKey, key)),
  )
  if (!role) {
    throw new Error(`Missing system role ${key}`)
  }
  return role.id
}

async function insertMembershipWithRole(workspaceId: string, userId: string, key: SystemRoleKey) {
  const roleId = await systemRoleId(workspaceId, key)
  const [membership] = await withWorkspace(databases.app, workspaceId, (tx) =>
    tx
      .insert(memberships)
      .values({ workspaceId, userId, roleId })
      .returning({ id: memberships.id }),
  )
  if (!membership) {
    throw new Error('Could not add the member')
  }
  return membership.id
}

function ownerMembershipOf(workspaceId: string, userId: string) {
  return and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId))
}

beforeAll(async () => {
  creatorId = await fixtures.createUser('creator')
  workspaceA = (await fixtures.createWorkspaceOwnedBy(creatorId, 'A')).workspaceId
  workspaceB = (await fixtures.createWorkspaceOwnedBy(creatorId, 'B')).workspaceId
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

describe('memberships', () => {
  it('are isolated per workspace', async () => {
    const newcomer = await fixtures.createUser('newcomer')
    await insertMembershipWithRole(workspaceB, newcomer, 'member')
    const visibleInA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ userId: memberships.userId }).from(memberships),
    )
    expect(visibleInA).toEqual([{ userId: creatorId }])
  })

  it('allow one active membership per user and workspace', async () => {
    const newcomer = await fixtures.createUser('newcomer')
    await insertMembershipWithRole(workspaceA, newcomer, 'member')
    const secondTime = insertMembershipWithRole(workspaceA, newcomer, 'viewer')
    expect(await postgresErrorCodeOf(secondTime)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })

  it('allow a user back after the old membership was soft deleted', async () => {
    const returning = await fixtures.createUser('returning')
    const firstMembership = await insertMembershipWithRole(workspaceA, returning, 'member')
    await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(memberships)
        .set({ deletedAt: new Date() })
        .where(eq(memberships.id, firstMembership)),
    )
    const comeback = insertMembershipWithRole(workspaceA, returning, 'viewer')
    expect(await postgresErrorCodeOf(comeback)).toBeUndefined()
  })

  it('reject a role from another workspace', async () => {
    const newcomer = await fixtures.createUser('newcomer')
    const roleFromB = await systemRoleId(workspaceB, 'member')
    const foreignRole = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .insert(memberships)
        .values({ workspaceId: workspaceA, userId: newcomer, roleId: roleFromB }),
    )
    expect(await postgresErrorCodeOf(foreignRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('keep a role from being deleted while it is assigned', async () => {
    const memberRole = await systemRoleId(workspaceA, 'member')
    const deleteAssignedRole = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.delete(roles).where(eq(roles.id, memberRole)),
    )
    expect(await postgresErrorCodeOf(deleteAssignedRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })
})

describe('owner invariant', () => {
  it('refuses removing the only owner', async () => {
    const removeOnlyOwner = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(memberships)
        .set({ deletedAt: new Date() })
        .where(ownerMembershipOf(workspaceA, creatorId)),
    )
    expect(await postgresErrorCodeOf(removeOnlyOwner)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuses demoting the only owner', async () => {
    const viewerRole = await systemRoleId(workspaceA, 'viewer')
    const demoteOnlyOwner = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(memberships)
        .set({ roleId: viewerRole })
        .where(ownerMembershipOf(workspaceA, creatorId)),
    )
    expect(await postgresErrorCodeOf(demoteOnlyOwner)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('refuses taking the owner key away from the owner role', async () => {
    const ownerRole = await systemRoleId(workspaceA, 'owner')
    const renameOwnerRole = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(roles).set({ systemKey: null }).where(eq(roles.id, ownerRole)),
    )
    expect(await postgresErrorCodeOf(renameOwnerRole)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('allows an owner to leave when another owner remains', async () => {
    const coOwner = await fixtures.createUser('co-owner')
    await insertMembershipWithRole(workspaceB, coOwner, 'owner')
    const creatorLeaves = withWorkspace(databases.app, workspaceB, (tx) =>
      tx
        .update(memberships)
        .set({ deletedAt: new Date() })
        .where(ownerMembershipOf(workspaceB, creatorId)),
    )
    expect(await postgresErrorCodeOf(creatorLeaves)).toBeUndefined()
  })

  it('still lets a whole workspace be erased', async () => {
    const eraser = await fixtures.createUser('eraser')
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(eraser, 'Erase')
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})

describe('membership preferences', () => {
  function preferencesOf(workspaceId: string, userId: string) {
    return withWorkspace(databases.app, workspaceId, (tx) =>
      tx.select().from(membershipPreferences).where(eq(membershipPreferences.userId, userId)),
    )
  }

  it('are created with defaults for the workspace creator', async () => {
    const [preferences] = await preferencesOf(workspaceA, creatorId)
    expect(preferences).toMatchObject({
      notifyBillsDaysBefore: 3,
      notifyChannel: 'whatsapp',
      notifyDailyDigest: false,
      notifyBudgetThresholdPct: 80,
      notifyVariableIncome: true,
    })
  })

  it('survive a member leaving and coming back', async () => {
    const returning = await fixtures.createUser('returning-prefs')
    const memberRole = await systemRoleId(workspaceA, 'member')
    const firstMembership = await withWorkspace(databases.app, workspaceA, (tx) =>
      addMember(tx, { workspaceId: workspaceA, userId: returning, roleId: memberRole }),
    )
    await withWorkspace(databases.app, workspaceA, async (tx) => {
      await tx
        .update(membershipPreferences)
        .set({ notifyDailyDigest: true })
        .where(eq(membershipPreferences.userId, returning))
      await tx
        .update(memberships)
        .set({ deletedAt: new Date() })
        .where(eq(memberships.id, firstMembership))
    })

    await withWorkspace(databases.app, workspaceA, (tx) =>
      addMember(tx, { workspaceId: workspaceA, userId: returning, roleId: memberRole }),
    )

    const [preferences] = await preferencesOf(workspaceA, returning)
    expect(preferences?.notifyDailyDigest).toBe(true)
  })

  it('are isolated per workspace', async () => {
    const seenFromA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ workspaceId: membershipPreferences.workspaceId }).from(membershipPreferences),
    )
    expect(seenFromA.every((row) => row.workspaceId === workspaceA)).toBe(true)
  })

  it.each([
    ['reminders 31 days before', { notifyBillsDaysBefore: 31 }],
    ['a 0% budget alert', { notifyBudgetThresholdPct: 0 }],
    ['a 101% budget alert', { notifyBudgetThresholdPct: 101 }],
  ])('reject %s', async (_label, change) => {
    const update = withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(membershipPreferences)
        .set(change)
        .where(eq(membershipPreferences.userId, creatorId)),
    )
    expect(await postgresErrorCodeOf(update)).toBe(POSTGRES_ERRORS.checkViolation)
  })
})
