import { createApp } from '@api/app'
import type { MemberItem, RoleItem } from '@api/modules/access'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests, TestSession } from '@api/testing/testing.types'
import type { Permission } from '@financas/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))

const RECORDER: Permission[] = [
  { module: 'entries', action: 'view' },
  { module: 'entries', action: 'create' },
  { module: 'attachments', action: 'view' },
  { module: 'attachments', action: 'create' },
]
const MEMBER_REMOVER: Permission[] = [
  { module: 'members', action: 'view' },
  { module: 'members', action: 'delete' },
]

let sessions: Record<'owner' | 'admin' | 'member' | 'viewer', TestSession>

beforeAll(async () => {
  sessions = {
    owner: await loggedInUser(app, databases.app, fixtures.runId, 'roles-owner'),
    admin: await loggedInUser(app, databases.app, fixtures.runId, 'roles-admin'),
    member: await loggedInUser(app, databases.app, fixtures.runId, 'roles-member'),
    viewer: await loggedInUser(app, databases.app, fixtures.runId, 'roles-viewer'),
  }
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function team() {
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(sessions.owner.userId, 'Roles')
  for (const key of ['admin', 'member', 'viewer'] as const) {
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      sessions[key].userId,
      key,
    )
  }
  const as = (key: keyof typeof sessions): SessionRequests => requestsAs(app, sessions[key])
  const base = `/api/workspaces/${workspaceId}`
  const roles = async () => (await (await as('owner').get(`${base}/roles`)).json()) as RoleItem[]
  const roleId = async (key: string) =>
    (await roles()).find((role) => role.systemKey === key)?.roleId ?? ''
  const membershipOf = async (key: keyof typeof sessions) => {
    const members = (await (await as('owner').get(`${base}/members`)).json()) as MemberItem[]
    return members.find((item) => item.userId === sessions[key].userId)?.membershipId ?? ''
  }
  const createRole = async (by: keyof typeof sessions, name: string, permissions: Permission[]) =>
    as(by).post(`${base}/roles`, { name, permissions })
  return { base, as, roles, roleId, membershipOf, createRole }
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function idOf(response: Response): Promise<string> {
  return ((await response.json()) as { roleId: string }).roleId
}

describe('GET /roles', () => {
  it('lists the system roles with their permissions to roles that may view members', async () => {
    const { base, as } = await team()
    const response = await as('member').get(`${base}/roles`)
    expect(response.status).toBe(200)
    const listed = (await response.json()) as RoleItem[]
    expect(listed.map((role) => role.systemKey)).toEqual(['owner', 'admin', 'member', 'viewer'])
    expect(listed[3]?.permissions).toContainEqual({ module: 'entries', action: 'view' })
    expect((await as('viewer').get(`${base}/roles`)).status).toBe(403)
  })
})

describe('custom roles', () => {
  it('lets an admin create a role and give it to a member, who then has those permissions', async () => {
    const { base, as, roles, membershipOf, createRole } = await team()
    const created = await createRole('admin', 'Lançador', RECORDER)
    expect(created.status).toBe(201)
    const recorderId = await idOf(created)
    expect((await roles()).find((role) => role.roleId === recorderId)?.permissions).toHaveLength(4)

    const viewerId = await membershipOf('viewer')
    expect(
      (await as('admin').patch(`${base}/members/${viewerId}`, { roleId: recorderId })).status,
    ).toBe(204)
    const access = (await (await as('viewer').get(base)).json()) as { permissions: Permission[] }
    expect(access.permissions).toContainEqual({ module: 'entries', action: 'create' })
  })

  it('never lets anyone grant more than they hold: creating, assigning or inviting', async () => {
    const { base, as, membershipOf, createRole } = await team()
    const byAdmin = await createRole('admin', 'Remover', MEMBER_REMOVER)
    expect([byAdmin.status, await codeOf(byAdmin)]).toEqual([403, 'PERMISSION_ESCALATION'])

    const removerId = await idOf(await createRole('owner', 'Remover', MEMBER_REMOVER))
    const assigned = await as('admin').patch(`${base}/members/${await membershipOf('viewer')}`, {
      roleId: removerId,
    })
    expect([assigned.status, await codeOf(assigned)]).toEqual([403, 'PERMISSION_ESCALATION'])

    const invited = await as('admin').post(`${base}/invitations`, {
      email: `alt-${crypto.randomUUID()}@example.test`,
      roleId: removerId,
    })
    expect([invited.status, await codeOf(invited)]).toEqual([403, 'PERMISSION_ESCALATION'])
  })

  it('refuses invalid permissions and a taken name', async () => {
    const { createRole } = await team()
    const withoutView = await createRole('owner', 'Sem ver', [
      { module: 'entries', action: 'create' },
    ])
    expect([withoutView.status, await codeOf(withoutView)]).toEqual([400, 'ROLE_INVALID'])

    await createRole('owner', 'Único', RECORDER)
    const taken = await createRole('owner', 'único', RECORDER)
    expect([taken.status, await codeOf(taken)]).toEqual([409, 'ROLE_NAME_TAKEN'])
  })
})

describe('PATCH /roles/:roleId', () => {
  it('edits roles but never the owner role', async () => {
    const { base, as, roleId, roles } = await team()
    const ownerRole = await as('owner').patch(`${base}/roles/${await roleId('owner')}`, {
      name: 'Chefe',
    })
    expect([ownerRole.status, await codeOf(ownerRole)]).toEqual([403, 'OWNER_ROLE_LOCKED'])

    const viewerRoleId = await roleId('viewer')
    const changed = await as('owner').patch(`${base}/roles/${viewerRoleId}`, {
      name: 'Observador',
      permissions: [{ module: 'reports', action: 'view' }],
    })
    expect(changed.status).toBe(204)
    expect((await roles()).find((role) => role.roleId === viewerRoleId)).toMatchObject({
      name: 'Observador',
      permissions: [{ module: 'reports', action: 'view' }],
    })
  })
})

describe('DELETE /roles/:roleId', () => {
  it('deletes an unused custom role, and refuses system roles and roles in use', async () => {
    const { base, as, roleId, membershipOf, createRole } = await team()
    const unused = await idOf(await createRole('owner', 'Temporário', RECORDER))
    expect((await as('member').del(`${base}/roles/${unused}`)).status).toBe(403)
    expect((await as('owner').del(`${base}/roles/${unused}`)).status).toBe(204)

    const system = await as('owner').del(`${base}/roles/${await roleId('viewer')}`)
    expect([system.status, await codeOf(system)]).toEqual([409, 'SYSTEM_ROLE'])

    const inUse = await idOf(await createRole('owner', 'Em uso', RECORDER))
    await as('owner').patch(`${base}/members/${await membershipOf('member')}`, { roleId: inUse })
    const refused = await as('owner').del(`${base}/roles/${inUse}`)
    expect([refused.status, await codeOf(refused)]).toEqual([409, 'ROLE_IN_USE'])
  })
})
