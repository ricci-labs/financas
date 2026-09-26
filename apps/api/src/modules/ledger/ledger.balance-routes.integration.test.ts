import { createApp } from '@api/app'
import type { AccountBalance } from '@api/modules/ledger'
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
let viewer: SessionRequests
let workspacePath: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'balances-owner')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'balances-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Balances')
  await addMemberWithSystemRole(
    databases.app,
    databases.owner,
    workspaceId,
    viewerSession.userId,
    'viewer',
  )
  owner = requestsAs(app, ownerSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function created(response: Promise<Response>): Promise<string> {
  const body = (await (await response).json()) as { accountId?: string; entryId?: string }
  const id = body.accountId ?? body.entryId
  if (!id) {
    throw new Error(`Nothing was created: ${JSON.stringify(body)}`)
  }
  return id
}

function account(kind: string, name: string, extra: object = {}) {
  return created(owner.post(`${workspacePath}/accounts`, { kind, name, ...extra }))
}

async function balances(): Promise<Map<string, AccountBalance>> {
  const response = await viewer.get(`${workspacePath}/balances`)
  expect(response.status).toBe(200)
  const rows = (await response.json()) as AccountBalance[]
  return new Map(rows.map((row) => [row.accountId, row]))
}

describe('GET /balances', () => {
  it('shows each account balance as the UI reads it, from active entries only', async () => {
    const checking = await account('checking', 'Conta X')
    const groceries = await account('expense_category', 'Mercado')
    const salary = await account('income_category', 'Salário', { incomeNature: 'fixed' })
    const entries = `${workspacePath}/entries`
    await owner.post(entries, {
      entryType: 'income',
      occurredOn: '2026-10-01',
      description: 'Salário',
      amountCents: 500_000,
      receivedInAccountId: checking,
      categoryId: salary,
    })
    await owner.post(entries, {
      entryType: 'expense',
      occurredOn: '2026-10-02',
      description: 'Feira',
      amountCents: 12_500,
      paidFromAccountId: checking,
      categoryId: groceries,
    })
    const mistake = await created(
      owner.post(entries, {
        entryType: 'expense',
        occurredOn: '2026-10-03',
        description: 'Engano',
        amountCents: 99_900,
        paidFromAccountId: checking,
        categoryId: groceries,
      }),
    )
    await owner.del(`${entries}/${mistake}`)

    const byAccount = await balances()
    expect(byAccount.get(checking)).toMatchObject({ class: 'asset', naturalBalanceCents: 487_500 })
    expect(byAccount.get(groceries)).toMatchObject({ naturalBalanceCents: 12_500 })
    expect(byAccount.get(salary)).toMatchObject({
      class: 'income',
      balanceCents: -500_000,
      naturalBalanceCents: 500_000,
    })
  })

  it('leaves out deleted accounts', async () => {
    const unused = await account('savings', 'Poupança antiga')
    await owner.del(`${workspacePath}/accounts/${unused}`)
    expect((await balances()).has(unused)).toBe(false)
  })
})
