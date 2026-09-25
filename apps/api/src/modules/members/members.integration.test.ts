import { withWorkspace } from '@api/core/db/tx'
import { hashToken } from '@api/core/security/tokens'
import { roles } from '@api/modules/access/access.table'
import { acceptInvitation, addMember, createInvitation } from '@api/modules/members'
import { invitations, membershipPreferences, memberships } from '@api/modules/members/members.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import {
  connectTestDatabases,
  POSTGRES_ERRORS,
  postgresErrorCodeOf,
  waitForBlockedQueries,
} from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import type { SystemRoleKey } from '@financas/shared'
import { and, eq, inArray, sql } from 'drizzle-orm'
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

describe('invitations', () => {
  type InvitationValues = Partial<typeof invitations.$inferInsert>
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

  async function invite(values: InvitationValues, workspaceId = workspaceA) {
    const roleId = values.roleId ?? (await systemRoleId(workspaceId, 'member'))
    return withWorkspace(databases.app, workspaceId, (tx) =>
      tx.insert(invitations).values({
        workspaceId,
        roleId,
        tokenHash: crypto.randomUUID(),
        invitedByUserId: creatorId,
        expiresAt: new Date(Date.now() + ONE_WEEK_MS),
        ...values,
      }),
    )
  }

  it('accept an email or a phone invitation', async () => {
    expect(
      await postgresErrorCodeOf(invite({ email: `friend-${fixtures.runId}@example.test` })),
    ).toBeUndefined()
    expect(await postgresErrorCodeOf(invite({ phoneE164: '+5511987654321' }))).toBeUndefined()
  })

  it.each<[string, InvitationValues]>([
    ['no contact at all', {}],
    ['both email and phone', { email: 'both@example.test', phoneE164: '+5511900000000' }],
    ['an email without @', { email: 'not-an-email' }],
    ['a phone without the + prefix', { phoneE164: '5511987654321' }],
    ['a phone that is too short', { phoneE164: '+55119' }],
    [
      'acceptance without the accepting user',
      { email: 'half@example.test', acceptedAt: new Date() },
    ],
    [
      'an expiry in the past',
      { email: 'late@example.test', expiresAt: new Date(Date.now() - 1000) },
    ],
  ])('reject %s', async (_label, values) => {
    expect(await postgresErrorCodeOf(invite(values))).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('allow one pending invitation per email, and a new one after revoking', async () => {
    const email = `Pending-${fixtures.runId}@example.test`
    await invite({ email })
    const duplicate = invite({ email: email.toLowerCase() })
    expect(await postgresErrorCodeOf(duplicate)).toBe(POSTGRES_ERRORS.uniqueViolation)

    await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(invitations).set({ deletedAt: new Date() }).where(eq(invitations.email, email)),
    )
    expect(await postgresErrorCodeOf(invite({ email }))).toBeUndefined()
  })

  it('reject a token hash that is already used', async () => {
    const tokenHash = crypto.randomUUID()
    await invite({ email: `token-a-${fixtures.runId}@example.test`, tokenHash })
    const reused = invite({ email: `token-b-${fixtures.runId}@example.test`, tokenHash })
    expect(await postgresErrorCodeOf(reused)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })

  it('reject a role from another workspace', async () => {
    const roleFromB = await systemRoleId(workspaceB, 'member')
    const foreignRole = invite({
      email: `foreign-${fixtures.runId}@example.test`,
      roleId: roleFromB,
    })
    expect(await postgresErrorCodeOf(foreignRole)).toBe(POSTGRES_ERRORS.foreignKeyViolation)
  })

  it('are isolated per workspace', async () => {
    await invite({ email: `only-b-${fixtures.runId}@example.test` }, workspaceB)
    const seenFromA = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ workspaceId: invitations.workspaceId }).from(invitations),
    )
    expect(seenFromA.every((row) => row.workspaceId === workspaceA)).toBe(true)
  })
})

describe('invitation flow', () => {
  const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000

  function whileMembershipsAreLocked<T>(work: () => Promise<T>) {
    return databases.owner.transaction(async (tx) => {
      await tx.execute(sql`lock table memberships in exclusive mode`)
      return work()
    })
  }

  async function inviteToA(email: string) {
    const roleId = await systemRoleId(workspaceA, 'member')
    return createInvitation(databases.app, {
      workspaceId: workspaceA,
      roleId,
      invitedByUserId: creatorId,
      email,
    })
  }

  it('stores only the hash of the token', async () => {
    const { invitationId, token } = await inviteToA(`hash-${fixtures.runId}@example.test`)
    const [stored] = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(invitations).where(eq(invitations.id, invitationId)),
    )
    expect(stored?.tokenHash).toBe(hashToken(token))
    expect(stored?.tokenHash).not.toContain(token)
  })

  it('lets the invited user join with the invited role', async () => {
    const guest = await fixtures.createUser('guest')
    const { invitationId, token } = await inviteToA(`guest-${fixtures.runId}@example.test`)

    const accepted = await acceptInvitation(databases.app, { token, userId: guest })

    const joined = await withWorkspace(databases.app, workspaceA, async (tx) => ({
      membership: await tx
        .select()
        .from(memberships)
        .where(eq(memberships.id, accepted.membershipId)),
      invitation: await tx.select().from(invitations).where(eq(invitations.id, invitationId)),
      preferences: await tx
        .select()
        .from(membershipPreferences)
        .where(eq(membershipPreferences.userId, guest)),
    }))
    expect(accepted.workspaceId).toBe(workspaceA)
    expect(joined.membership).toMatchObject([
      { userId: guest, roleId: await systemRoleId(workspaceA, 'member') },
    ])
    expect(joined.invitation).toMatchObject([{ acceptedByUserId: guest }])
    expect(joined.preferences).toHaveLength(1)
  })

  it('does not expose invitations to a user without a workspace', async () => {
    await inviteToA(`hidden-${fixtures.runId}@example.test`)
    const visible = await databases.app.select().from(invitations)
    expect(visible).toEqual([])
  })

  it('refuses an unknown token', async () => {
    const guest = await fixtures.createUser('unknown-token')
    await expect(
      acceptInvitation(databases.app, { token: 'not-a-real-token', userId: guest }),
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' })
  })

  it('refuses an expired invitation', async () => {
    const guest = await fixtures.createUser('late-guest')
    const { token } = await inviteToA(`late-${fixtures.runId}@example.test`)
    const eightDaysLater = { now: () => new Date(Date.now() + EIGHT_DAYS_MS) }
    await expect(
      acceptInvitation(databases.app, { token, userId: guest }, eightDaysLater),
    ).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' })
  })

  it('refuses an invitation that was already accepted', async () => {
    const first = await fixtures.createUser('first-guest')
    const second = await fixtures.createUser('second-guest')
    const { token } = await inviteToA(`once-${fixtures.runId}@example.test`)
    await acceptInvitation(databases.app, { token, userId: first })
    await expect(acceptInvitation(databases.app, { token, userId: second })).rejects.toMatchObject({
      code: 'INVITATION_ALREADY_ACCEPTED',
    })
  })

  it('lets only one of two users racing on the same token join', async () => {
    const racers = [await fixtures.createUser('racer-1'), await fixtures.createUser('racer-2')]
    const { token } = await inviteToA(`race-${fixtures.runId}@example.test`)

    const race = await whileMembershipsAreLocked(async () => {
      const outcomes = Promise.allSettled(
        racers.map((userId) => acceptInvitation(databases.app, { token, userId })),
      )
      await waitForBlockedQueries(databases.owner, racers.length)
      return { outcomes }
    })

    const outcomes = await race.outcomes
    const joinedRacers = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select().from(memberships).where(inArray(memberships.userId, racers)),
    )
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toMatchObject([
      { reason: { code: 'INVITATION_ALREADY_ACCEPTED' } },
    ])
    expect(joinedRacers).toHaveLength(1)
  })

  it('refuses a revoked invitation', async () => {
    const guest = await fixtures.createUser('revoked-guest')
    const { invitationId, token } = await inviteToA(`revoked-${fixtures.runId}@example.test`)
    await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.update(invitations).set({ deletedAt: new Date() }).where(eq(invitations.id, invitationId)),
    )
    await expect(acceptInvitation(databases.app, { token, userId: guest })).rejects.toMatchObject({
      code: 'INVITATION_REVOKED',
    })
  })

  it('refuses a user who is already a member', async () => {
    const { token } = await inviteToA(`member-${fixtures.runId}@example.test`)
    await expect(
      acceptInvitation(databases.app, { token, userId: creatorId }),
    ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' })
  })
})
