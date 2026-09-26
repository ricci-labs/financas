import { createApp } from '@api/app'
import type { AllocationStepItem } from '@api/modules/planning'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { todayIn } from '@financas/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let member: SessionRequests
let viewer: SessionRequests
let workspacePath: string
let stepsPath: string
let reserveGoalId: string
let tripAccountId: string
let categoryId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'split-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'split-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'split-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Split')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  const owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
  stepsPath = `${workspacePath}/allocation-steps`
  const account = async (kind: string, name: string) =>
    (
      (await (await owner.post(`${workspacePath}/accounts`, { kind, name })).json()) as {
        accountId: string
      }
    ).accountId
  const reserveAccount = await account('savings', 'Reserva')
  tripAccountId = await account('savings', 'Viagem')
  categoryId = await account('expense_category', 'Lazer')
  reserveGoalId = (
    (await (
      await owner.post(`${workspacePath}/goals`, {
        name: 'Reserva',
        targetCents: 1_000_000,
        accountId: reserveAccount,
        isReserve: true,
      })
    ).json()) as { goalId: string }
  ).goalId
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function steps(): Promise<AllocationStepItem[]> {
  return (await (await viewer.get(stepsPath)).json()) as AllocationStepItem[]
}

describe('allocation steps', () => {
  it('store the household waterfall in order, replacing the previous one', async () => {
    const put = await member.put(stepsPath, {
      steps: [
        { kind: 'fill_goal', goalId: reserveGoalId },
        { kind: 'cover_overspent' },
        { kind: 'percent', accountId: tripAccountId, percent: 30 },
        { kind: 'rest', accountId: tripAccountId },
      ],
    })
    expect(put.status).toBe(204)
    expect(await steps()).toEqual([
      {
        position: 1,
        kind: 'fill_goal',
        goalId: reserveGoalId,
        accountId: null,
        percent: null,
        amountCents: null,
      },
      {
        position: 2,
        kind: 'cover_overspent',
        goalId: null,
        accountId: null,
        percent: null,
        amountCents: null,
      },
      {
        position: 3,
        kind: 'percent',
        goalId: null,
        accountId: tripAccountId,
        percent: 30,
        amountCents: null,
      },
      {
        position: 4,
        kind: 'rest',
        goalId: null,
        accountId: tripAccountId,
        percent: null,
        amountCents: null,
      },
    ])

    await member.put(stepsPath, {
      steps: [{ kind: 'fixed_amount', accountId: tripAccountId, amountCents: 50_000 }],
    })
    expect((await steps()).map((step) => step.kind)).toEqual(['fixed_amount'])
    await member.put(stepsPath, { steps: [] })
    expect(await steps()).toEqual([])
  })

  it('refuse a viewer, the rest before the end, a non-money account and an unknown goal', async () => {
    expect((await viewer.put(stepsPath, { steps: [] })).status).toBe(403)

    const restFirst = await member.put(stepsPath, {
      steps: [{ kind: 'rest', accountId: tripAccountId }, { kind: 'cover_overspent' }],
    })
    expect([restFirst.status, await codeOf(restFirst)]).toEqual([400, 'ALLOCATION_INVALID'])

    const toCategory = await member.put(stepsPath, {
      steps: [{ kind: 'rest', accountId: categoryId }],
    })
    expect([toCategory.status, await codeOf(toCategory)]).toEqual([
      400,
      'ALLOCATION_ACCOUNT_INVALID',
    ])

    const unknownGoal = await member.put(stepsPath, {
      steps: [{ kind: 'fill_goal', goalId: UNKNOWN_ID }],
    })
    expect([unknownGoal.status, await codeOf(unknownGoal)]).toEqual([
      400,
      'ALLOCATION_GOAL_INVALID',
    ])
  })
})

describe('GET /allocation/suggestion', () => {
  it('splits a commission along the waterfall', async () => {
    await member.put(stepsPath, {
      steps: [
        { kind: 'fill_goal', goalId: reserveGoalId },
        { kind: 'rest', accountId: tripAccountId },
      ],
    })
    const response = await viewer.get(`${workspacePath}/allocation/suggestion?amountCents=1200000`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      parts: [
        { position: 1, kind: 'fill_goal', toAccountId: expect.any(String), amountCents: 1_000_000 },
        { position: 2, kind: 'rest', toAccountId: tripAccountId, amountCents: 200_000 },
      ],
      leftoverCents: 0,
    })
    const invalid = await viewer.get(`${workspacePath}/allocation/suggestion?amountCents=0`)
    expect([invalid.status, await codeOf(invalid)]).toEqual([400, 'ALLOCATION_QUERY_INVALID'])
  })
})

describe('GET /allocation/suggestion when the period is overspent', () => {
  it('covers the overrun of the current period before anything else', async () => {
    const checking = (
      (await (await member.get(`${workspacePath}/accounts`)).json()) as {
        id: string
        kind: string
      }[]
    ).find((account) => account.kind === 'savings')?.id
    await member.post(`${workspacePath}/entries`, {
      entryType: 'expense',
      occurredOn: todayIn('America/Sao_Paulo', new Date()),
      description: 'Conserto',
      amountCents: 30_000,
      paidFromAccountId: checking,
      categoryId,
    })
    await member.put(stepsPath, {
      steps: [{ kind: 'cover_overspent' }, { kind: 'rest', accountId: tripAccountId }],
    })

    const response = await viewer.get(`${workspacePath}/allocation/suggestion?amountCents=100000`)
    expect(await response.json()).toEqual({
      parts: [
        { position: 1, kind: 'cover_overspent', toAccountId: null, amountCents: 30_000 },
        { position: 2, kind: 'rest', toAccountId: tripAccountId, amountCents: 70_000 },
      ],
      leftoverCents: 0,
    })
  })
})
