import { createApp } from '@api/app'
import type { MemberItem } from '@api/modules/access'
import { roles } from '@api/modules/access/access.table'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests, TestSession } from '@api/testing/testing.types'
import type { SystemRoleKey } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let sessions: Record<'owner' | 'admin' | 'member' | 'viewer', TestSession>

beforeAll(async () => {
  sessions = {
    owner: await loggedInUser(app, databases.app, fixtures.runId, 'team-owner'),
    admin: await loggedInUser(app, databases.app, fixtures.runId, 'team-admin'),
    member: await loggedInUser(app, databases.app, fixtures.runId, 'team-member'),
    viewer: await loggedInUser(app, databases.app, fixtures.runId, 'team-viewer'),
  }
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function team() {
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(sessions.owner.userId, 'Team')
  for (const key of ['admin', 'member', 'viewer'] as const) {
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      sessions[key].userId,
      key,
    )
  }
  const roleRows = await databases.owner
    .select({ id: roles.id, systemKey: roles.systemKey })
    .from(roles)
    .where(eq(roles.workspaceId, workspaceId))
  const roleIds = Object.fromEntries(roleRows.map((role) => [role.systemKey, role.id])) as Record<
    SystemRoleKey,
    string
  >
  const as = (key: keyof typeof sessions): SessionRequests => requestsAs(app, sessions[key])
  const membersPath = `/api/workspaces/${workspaceId}/members`
  const members = async () => (await (await as('owner').get(membersPath)).json()) as MemberItem[]
  const membershipOf = async (key: keyof typeof sessions) => {
    const found = (await members()).find((item) => item.userId === sessions[key].userId)
    return found?.membershipId ?? ''
  }
  return { workspaceId, roleIds, as, membersPath, members, membershipOf }
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('GET /members', () => {
  it('lists every member with name, email and role to roles that may view them', async () => {
    const { as, membersPath } = await team()
    const response = await as('member').get(membersPath)
    expect(response.status).toBe(200)
    const listed = (await response.json()) as MemberItem[]
    expect(listed.map((item) => [item.displayName, item.role.systemKey])).toEqual([
      ['Member team-owner', 'owner'],
      ['Member team-admin', 'admin'],
      ['Member team-member', 'member'],
      ['Member team-viewer', 'viewer'],
    ])
    expect(listed[0]?.email).toBe(sessions.owner.email)
    expect((await as('viewer').get(membersPath)).status).toBe(403)
  })
})

describe('PATCH /members/:membershipId', () => {
  it('lets an admin change a member role, and refuses a member', async () => {
    const { as, membersPath, roleIds, members, membershipOf } = await team()
    const viewerId = await membershipOf('viewer')

    expect(
      (await as('member').patch(`${membersPath}/${viewerId}`, { roleId: roleIds.member })).status,
    ).toBe(403)
    expect(
      (await as('admin').patch(`${membersPath}/${viewerId}`, { roleId: roleIds.member })).status,
    ).toBe(204)
    expect((await members()).find((item) => item.membershipId === viewerId)?.role.systemKey).toBe(
      'member',
    )
  })

  it('leaves owners to owners: promoting to owner and changing an owner', async () => {
    const { as, membersPath, roleIds, membershipOf } = await team()
    const adminId = await membershipOf('admin')
    const ownerId = await membershipOf('owner')

    const promotedByAdmin = await as('admin').patch(`${membersPath}/${adminId}`, {
      roleId: roleIds.owner,
    })
    expect([promotedByAdmin.status, await codeOf(promotedByAdmin)]).toEqual([403, 'OWNER_ONLY'])
    const demotedByAdmin = await as('admin').patch(`${membersPath}/${ownerId}`, {
      roleId: roleIds.admin,
    })
    expect([demotedByAdmin.status, await codeOf(demotedByAdmin)]).toEqual([403, 'OWNER_ONLY'])

    expect(
      (await as('owner').patch(`${membersPath}/${adminId}`, { roleId: roleIds.owner })).status,
    ).toBe(204)
    expect(
      (await as('admin').patch(`${membersPath}/${ownerId}`, { roleId: roleIds.admin })).status,
    ).toBe(204)
  })

  it('never leaves a workspace without an owner', async () => {
    const { as, membersPath, roleIds, membershipOf } = await team()
    const ownerId = await membershipOf('owner')
    const response = await as('owner').patch(`${membersPath}/${ownerId}`, { roleId: roleIds.admin })
    expect([response.status, await codeOf(response)]).toEqual([409, 'LAST_OWNER'])
  })

  it('answers 404 for a malformed or unknown member and 400 for a foreign role', async () => {
    const { as, membersPath, membershipOf } = await team()
    const other = await team()
    for (const membershipId of ['not-a-uuid', UNKNOWN_ID]) {
      const response = await as('owner').patch(`${membersPath}/${membershipId}`, {
        roleId: other.roleIds.member,
      })
      expect([response.status, await codeOf(response)]).toEqual([404, 'MEMBER_NOT_FOUND'])
    }
    const foreignRole = await as('owner').patch(`${membersPath}/${await membershipOf('viewer')}`, {
      roleId: other.roleIds.member,
    })
    expect([foreignRole.status, await codeOf(foreignRole)]).toEqual([400, 'ROLE_NOT_AVAILABLE'])
  })
})

describe('removing members', () => {
  it('lets an owner remove a member, who then loses access; an admin may not', async () => {
    const { workspaceId, as, membersPath, membershipOf } = await team()
    const viewerId = await membershipOf('viewer')

    expect((await as('admin').del(`${membersPath}/${viewerId}`)).status).toBe(403)
    expect(
      (await as('owner').del(`${membersPath}/${viewerId}`, { reason: 'Saiu de casa' })).status,
    ).toBe(204)
    expect((await as('viewer').get(`/api/workspaces/${workspaceId}`)).status).toBe(404)
  })

  it('lets anyone leave, except the last owner', async () => {
    const { workspaceId, as, membersPath } = await team()
    expect((await as('viewer').post(`${membersPath}/leave`)).status).toBe(204)
    expect((await as('viewer').get(`/api/workspaces/${workspaceId}`)).status).toBe(404)

    const lastOwner = await as('owner').post(`${membersPath}/leave`)
    expect([lastOwner.status, await codeOf(lastOwner)]).toEqual([409, 'LAST_OWNER'])
  })
})
