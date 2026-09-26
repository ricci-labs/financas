import { createApp } from '@api/app'
import type { WorkspaceListItem } from '@api/modules/access'
import type { WorkspaceSettings } from '@api/modules/workspaces'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))

let owner: SessionRequests
let admin: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let workspacePath: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'ws-owner')
  const adminSession = await loggedInUser(app, databases.app, fixtures.runId, 'ws-admin')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'ws-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'ws-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Settings')
  for (const [session, role] of [
    [adminSession, 'admin'],
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  admin = requestsAs(app, adminSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('POST /api/workspaces', () => {
  it('lets any logged-in user create a workspace they own', async () => {
    const response = await viewer.post('/api/workspaces', { name: `  Pessoal ${fixtures.runId} ` })
    expect(response.status).toBe(201)
    const { workspaceId } = (await response.json()) as { workspaceId: string }

    const listed = (await (await viewer.get('/api/workspaces')).json()) as WorkspaceListItem[]
    expect(listed).toContainEqual(
      expect.objectContaining({
        workspaceId,
        name: `Pessoal ${fixtures.runId}`,
        role: expect.objectContaining({ systemKey: 'owner' }),
      }),
    )
  })

  it('refuses an empty name', async () => {
    const response = await viewer.post('/api/workspaces', { name: '   ' })
    expect([response.status, await codeOf(response)]).toEqual([400, 'WORKSPACE_NAME_INVALID'])
  })
})

describe('PATCH /api/workspaces/:workspaceId', () => {
  it('renames for roles with settings:update only', async () => {
    expect((await member.patch(workspacePath, { name: 'Nope' })).status).toBe(403)
    expect((await viewer.patch(workspacePath, { name: 'Nope' })).status).toBe(403)
    expect((await admin.patch(workspacePath, { name: `Casa ${fixtures.runId}` })).status).toBe(204)

    const detail = (await (await owner.get(workspacePath)).json()) as {
      workspace: { name: string }
    }
    expect(detail.workspace.name).toBe(`Casa ${fixtures.runId}`)
  })
})

describe('workspace settings', () => {
  it('shows the defaults to members and hides them from viewers', async () => {
    const response = await member.get(`${workspacePath}/settings`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      periodAnchor: 'calendar_month',
      periodAnchorValue: null,
      budgetBase: 'fixed_income',
    })
    expect((await viewer.get(`${workspacePath}/settings`)).status).toBe(403)
  })

  it('changes the financial period and resets the value for a calendar month', async () => {
    const byDay = await owner.patch(`${workspacePath}/settings`, {
      periodAnchor: 'day_of_month',
      periodAnchorValue: 5,
      installmentBudgetView: 'purchase_month',
    })
    expect(byDay.status).toBe(200)
    expect((await byDay.json()) as WorkspaceSettings).toMatchObject({
      periodAnchor: 'day_of_month',
      periodAnchorValue: 5,
      installmentBudgetView: 'purchase_month',
    })

    const calendar = await owner.patch(`${workspacePath}/settings`, {
      periodAnchor: 'calendar_month',
    })
    expect(await calendar.json()).toMatchObject({
      periodAnchor: 'calendar_month',
      periodAnchorValue: null,
    })
  })

  it('refuses members, values that do not fit and fields that are not settings here', async () => {
    expect((await member.patch(`${workspacePath}/settings`, { weekStartsOn: 1 })).status).toBe(403)

    const invalid = [
      { periodAnchor: 'nth_business_day', periodAnchorValue: 11 },
      { periodAnchorValue: 3 },
      { timezone: 'Mars/Olympus' },
      { pixReceivingKey: 'someone@example.test' },
      {},
    ]
    for (const change of invalid) {
      const response = await owner.patch(`${workspacePath}/settings`, change)
      expect([response.status, await codeOf(response)]).toEqual([400, 'SETTINGS_INVALID'])
    }
  })
})
