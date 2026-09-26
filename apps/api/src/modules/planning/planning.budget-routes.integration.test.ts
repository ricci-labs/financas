import { createApp } from '@api/app'
import type { BudgetItem } from '@api/modules/planning'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))

let admin: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let workspacePath: string
let groceriesId: string
let salaryId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'budgets-owner')
  const adminSession = await loggedInUser(app, databases.app, fixtures.runId, 'budgets-admin')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'budgets-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'budgets-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Budgets')
  for (const [session, role] of [
    [adminSession, 'admin'],
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  admin = requestsAs(app, adminSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
  groceriesId = await accountId(
    admin.post(`${workspacePath}/accounts`, { kind: 'expense_category', name: 'Mercado' }),
  )
  salaryId = await accountId(
    admin.post(`${workspacePath}/accounts`, {
      kind: 'income_category',
      name: 'Salário',
      incomeNature: 'fixed',
    }),
  )
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function accountId(response: Promise<Response>): Promise<string> {
  return ((await (await response).json()) as { accountId: string }).accountId
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function budgetsOf(period: string): Promise<BudgetItem[]> {
  return (await (
    await member.get(`${workspacePath}/budgets?period=${period}`)
  ).json()) as BudgetItem[]
}

function setGroceries(limitCents: number | null, fromPeriod: string) {
  return admin.put(`${workspacePath}/budgets/${groceriesId}`, { limitCents, fromPeriod })
}

describe('budgets', () => {
  it('keep a limit month after month until it changes or stops', async () => {
    expect((await setGroceries(150_000, '2026-10')).status).toBe(204)
    await setGroceries(180_000, '2027-01')
    await setGroceries(null, '2027-06')

    expect(await budgetsOf('2026-09')).toEqual([])
    expect(await budgetsOf('2026-12')).toEqual([
      { categoryAccountId: groceriesId, limitCents: 150_000, validFrom: '2026-10' },
    ])
    expect(await budgetsOf('2027-03')).toEqual([
      { categoryAccountId: groceriesId, limitCents: 180_000, validFrom: '2027-01' },
    ])
    expect(await budgetsOf('2027-06')).toEqual([])

    await setGroceries(170_000, '2027-01')
    expect((await budgetsOf('2027-01'))[0]?.limitCents).toBe(170_000)
  })

  it('are set by roles with budgets:update, on expense categories only', async () => {
    const byMember = await member.put(`${workspacePath}/budgets/${groceriesId}`, {
      limitCents: 1,
      fromPeriod: '2026-10',
    })
    expect(byMember.status).toBe(403)

    const onIncome = await admin.put(`${workspacePath}/budgets/${salaryId}`, {
      limitCents: 1,
      fromPeriod: '2026-10',
    })
    expect([onIncome.status, await codeOf(onIncome)]).toEqual([400, 'BUDGET_CATEGORY_INVALID'])

    for (const body of [
      { limitCents: 0, fromPeriod: '2026-10' },
      { limitCents: 100, fromPeriod: '2026-13' },
      { limitCents: 100 },
    ]) {
      const response = await admin.put(`${workspacePath}/budgets/${groceriesId}`, body)
      expect([response.status, await codeOf(response)]).toEqual([400, 'BUDGET_INVALID'])
    }
  })

  it('are visible to viewers, for a valid period only', async () => {
    expect((await viewer.get(`${workspacePath}/budgets?period=2026-10`)).status).toBe(200)
    const invalid = await viewer.get(`${workspacePath}/budgets?period=2026-10-01`)
    expect([invalid.status, await codeOf(invalid)]).toEqual([400, 'BUDGET_QUERY_INVALID'])
  })
})
