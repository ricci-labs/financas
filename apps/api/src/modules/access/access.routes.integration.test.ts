import { createApp } from '@api/app'
import { withWorkspace } from '@api/core/db/tx'
import { authorize } from '@api/modules/access'
import { roles } from '@api/modules/access/access.table'
import { createUser } from '@api/modules/identity'
import { addMember } from '@api/modules/members'
import { memberships } from '@api/modules/members/members.table'
import { createWorkspace } from '@api/modules/onboarding'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createCapturingLogger } from '@api/testing/logger'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const PASSWORD = 'a long enough password'
const FAST_COST = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const SESSION_COOKIE = /^session=([\w-]{43});/
const UNKNOWN_WORKSPACE_ID = '01900000-0000-7000-8000-000000000000'

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function testApp() {
  const capture = createCapturingLogger()
  const app = createApp(testAppDeps({ db: databases.app, logger: capture.logger }))
    .get('/api/workspaces/:workspaceId/probe/view', authorize('entries', 'view'), (c) =>
      c.text('viewed'),
    )
    .post('/api/workspaces/:workspaceId/probe/create', authorize('entries', 'create'), (c) =>
      c.text('created'),
    )
  return { app, entries: capture.entries }
}

async function userWithSession(app: ReturnType<typeof testApp>['app'], label: string) {
  const email = `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
  const userId = await createUser(
    databases.app,
    { email, displayName: `Member ${label}`, password: PASSWORD, isEmailVerified: true },
    { passwordCost: FAST_COST },
  )
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const token = response.headers.get('Set-Cookie')?.match(SESSION_COOKIE)?.[1]
  return { userId, cookie: `session=${token}` }
}

async function workspaceOwnedBy(userId: string, name: string) {
  return createWorkspace(databases.app, { name: `${name} ${fixtures.runId}`, ownerUserId: userId })
}

async function addViewer(workspaceId: string, userId: string) {
  const [viewer] = await databases.owner
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.workspaceId, workspaceId), eq(roles.systemKey, 'viewer')))
  return withWorkspace(databases.app, workspaceId, (tx) =>
    addMember(tx, { workspaceId, userId, roleId: viewer?.id ?? '' }),
  )
}

function get(app: ReturnType<typeof testApp>['app'], path: string, cookie: string) {
  return app.request(path, { headers: { Cookie: cookie } })
}

function post(app: ReturnType<typeof testApp>['app'], path: string, cookie: string) {
  return app.request(path, { method: 'POST', headers: { Cookie: cookie, Origin: TEST_PUBLIC_URL } })
}

describe('GET /api/workspaces/:workspaceId', () => {
  it('shows a member the workspace, their role and their permissions', async () => {
    const { app } = testApp()
    const owner = await userWithSession(app, 'access-owner')
    const { workspaceId, ownerMembershipId } = await workspaceOwnedBy(owner.userId, 'Casa')

    const response = await get(app, `/api/workspaces/${workspaceId}`, owner.cookie)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      workspace: { workspaceId, name: `Casa ${fixtures.runId}`, isArchived: false },
      membershipId: ownerMembershipId,
      role: { systemKey: 'owner' },
      permissions: expect.arrayContaining([{ module: 'entries', action: 'create' }]),
    })
  })

  it('answers 404 to someone who is not a member, as if it did not exist', async () => {
    const { app } = testApp()
    const owner = await userWithSession(app, 'access-owner-2')
    const stranger = await userWithSession(app, 'access-stranger')
    const { workspaceId } = await workspaceOwnedBy(owner.userId, 'Private')

    for (const id of [workspaceId, UNKNOWN_WORKSPACE_ID, 'not-a-uuid']) {
      const response = await get(app, `/api/workspaces/${id}`, stranger.cookie)
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ error: { code: 'WORKSPACE_NOT_FOUND' } })
    }
  })

  it('answers 404 once the membership or the workspace is deleted', async () => {
    const { app } = testApp()
    const owner = await userWithSession(app, 'access-owner-3')
    const viewer = await userWithSession(app, 'access-leaving')
    const { workspaceId } = await workspaceOwnedBy(owner.userId, 'Leaving')
    const viewerMembershipId = await addViewer(workspaceId, viewer.userId)

    expect((await get(app, `/api/workspaces/${workspaceId}`, viewer.cookie)).status).toBe(200)
    await databases.owner
      .update(memberships)
      .set({ deletedAt: new Date() })
      .where(eq(memberships.id, viewerMembershipId))
    expect((await get(app, `/api/workspaces/${workspaceId}`, viewer.cookie)).status).toBe(404)

    await databases.owner
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
    expect((await get(app, `/api/workspaces/${workspaceId}`, owner.cookie)).status).toBe(404)
  })

  it('asks for a session first', async () => {
    const { app } = testApp()
    const response = await app.request(`/api/workspaces/${UNKNOWN_WORKSPACE_ID}`)
    expect(response.status).toBe(401)
  })
})

describe('authorize', () => {
  it('lets a role do what its permissions allow and refuses the rest with 403', async () => {
    const { app, entries } = testApp()
    const owner = await userWithSession(app, 'authz-owner')
    const viewer = await userWithSession(app, 'authz-viewer')
    const { workspaceId } = await workspaceOwnedBy(owner.userId, 'Shared')
    await addViewer(workspaceId, viewer.userId)
    const probe = `/api/workspaces/${workspaceId}/probe`

    expect((await get(app, `${probe}/view`, viewer.cookie)).status).toBe(200)
    expect((await post(app, `${probe}/create`, owner.cookie)).status).toBe(200)

    const denied = await post(app, `${probe}/create`, viewer.cookie)
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({ error: { code: 'PERMISSION_DENIED' } })
    expect(entries()).toContainEqual(
      expect.objectContaining({
        event: 'authz.denied',
        module: 'entries',
        action: 'create',
        workspaceId,
        userId: viewer.userId,
      }),
    )
  })

  it('runs only after membership, so a stranger gets 404 and never learns the rule', async () => {
    const { app } = testApp()
    const owner = await userWithSession(app, 'authz-owner-2')
    const stranger = await userWithSession(app, 'authz-stranger')
    const { workspaceId } = await workspaceOwnedBy(owner.userId, 'Closed')

    const response = await post(app, `/api/workspaces/${workspaceId}/probe/create`, stranger.cookie)
    expect(response.status).toBe(404)
  })
})

describe('GET /api/workspaces', () => {
  it('lists every workspace of the caller with their role, by name, and nothing else', async () => {
    const { app } = testApp()
    const member = await userWithSession(app, 'list-member')
    const someoneElse = await userWithSession(app, 'list-other')
    const own = await workspaceOwnedBy(member.userId, 'Beta')
    const shared = await workspaceOwnedBy(someoneElse.userId, 'Alfa')
    await workspaceOwnedBy(someoneElse.userId, 'Gama')
    await addViewer(shared.workspaceId, member.userId)

    const response = await get(app, '/api/workspaces', member.cookie)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      expect.objectContaining({
        workspaceId: shared.workspaceId,
        name: `Alfa ${fixtures.runId}`,
        isArchived: false,
        role: expect.objectContaining({ systemKey: 'viewer' }),
      }),
      expect.objectContaining({
        workspaceId: own.workspaceId,
        name: `Beta ${fixtures.runId}`,
        role: expect.objectContaining({ systemKey: 'owner' }),
      }),
    ])
  })

  it('leaves out workspaces the caller left or that were deleted', async () => {
    const { app } = testApp()
    const member = await userWithSession(app, 'list-leaving')
    const owner = await userWithSession(app, 'list-owner')
    const left = await workspaceOwnedBy(owner.userId, 'Left')
    const deleted = await workspaceOwnedBy(member.userId, 'Deleted')
    const kept = await workspaceOwnedBy(member.userId, 'Kept')
    const leftMembershipId = await addViewer(left.workspaceId, member.userId)

    await databases.owner
      .update(memberships)
      .set({ deletedAt: new Date() })
      .where(eq(memberships.id, leftMembershipId))
    await databases.owner
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, deleted.workspaceId))

    const response = await get(app, '/api/workspaces', member.cookie)
    const listed = (await response.json()) as { workspaceId: string }[]
    expect(listed.map((item) => item.workspaceId)).toEqual([kept.workspaceId])
  })

  it('answers an empty list to a user without workspaces', async () => {
    const { app } = testApp()
    const loner = await userWithSession(app, 'list-loner')
    const response = await get(app, '/api/workspaces', loner.cookie)
    expect(await response.json()).toEqual([])
  })

  it('asks for a session', async () => {
    const { app } = testApp()
    expect((await app.request('/api/workspaces')).status).toBe(401)
  })
})
