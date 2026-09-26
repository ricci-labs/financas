import { createApp } from '@api/app'
import type { CardItem } from '@api/modules/ledger'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let owner: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let workspacePath: string
let checkingAccountId: string
let categoryId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'cards-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'cards-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'cards-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Cards')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
  checkingAccountId = await createAccount('checking', 'Conta X')
  categoryId = await createAccount('expense_category', 'Mercado')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function createAccount(kind: string, name: string): Promise<string> {
  const response = await owner.post(`${workspacePath}/accounts`, { kind, name })
  return ((await response.json()) as { accountId: string }).accountId
}

async function createCard(requests: SessionRequests, name: string, extra: object = {}) {
  return requests.post(`${workspacePath}/cards`, { name, closingDay: 3, dueDay: 10, ...extra })
}

async function cards(): Promise<CardItem[]> {
  return (await (await owner.get(`${workspacePath}/cards`)).json()) as CardItem[]
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('POST and GET /cards', () => {
  it('lets a member create a card with its cycle, limit and payment account', async () => {
    const response = await createCard(member, 'Card X', {
      limitCents: 500_000,
      paymentAccountId: checkingAccountId,
    })
    expect(response.status).toBe(201)
    const { accountId } = (await response.json()) as { accountId: string }
    expect(await cards()).toContainEqual(
      expect.objectContaining({
        accountId,
        name: 'Card X',
        closingDay: 3,
        dueDay: 10,
        limitCents: 500_000,
        paymentAccountId: checkingAccountId,
        purchaseOnClosingDayGoesNext: true,
      }),
    )
  })

  it('refuses a viewer, an invalid cycle and a payment account that holds no money', async () => {
    expect((await createCard(viewer, 'Card V')).status).toBe(403)

    const badDay = await createCard(owner, 'Card B', { closingDay: 32 })
    expect([badDay.status, await codeOf(badDay)]).toEqual([400, 'CARD_INVALID'])

    const fromCategory = await createCard(owner, 'Card C', { paymentAccountId: categoryId })
    expect([fromCategory.status, await codeOf(fromCategory)]).toEqual([
      400,
      'PAYMENT_ACCOUNT_NOT_AVAILABLE',
    ])
  })
})

describe('PATCH /cards/:cardId', () => {
  it('changes the cycle for a member and refuses a viewer', async () => {
    const created = await createCard(owner, 'Card P')
    const { accountId } = (await created.json()) as { accountId: string }

    expect((await viewer.patch(`${workspacePath}/cards/${accountId}`, { dueDay: 15 })).status).toBe(
      403,
    )
    expect((await member.patch(`${workspacePath}/cards/${accountId}`, { dueDay: 15 })).status).toBe(
      204,
    )
    expect(await cards()).toContainEqual(expect.objectContaining({ accountId, dueDay: 15 }))
  })

  it('never reaches an account that is not a card', async () => {
    for (const cardId of [checkingAccountId, UNKNOWN_ID, 'not-a-uuid']) {
      const response = await owner.patch(`${workspacePath}/cards/${cardId}`, { dueDay: 20 })
      expect([response.status, await codeOf(response)]).toEqual([404, 'CARD_NOT_FOUND'])
    }
  })
})

describe('GET /cards/:cardId/invoices', () => {
  it('lists the invoices of a card and 404s for anything that is not one', async () => {
    const created = await createCard(owner, 'Card I')
    const { accountId } = (await created.json()) as { accountId: string }

    const invoices = await viewer.get(`${workspacePath}/cards/${accountId}/invoices`)
    expect([invoices.status, await invoices.json()]).toEqual([200, []])

    for (const cardId of [checkingAccountId, UNKNOWN_ID, 'not-a-uuid']) {
      const response = await owner.get(`${workspacePath}/cards/${cardId}/invoices`)
      expect([response.status, await codeOf(response)]).toEqual([404, 'CARD_NOT_FOUND'])
    }
  })
})
