import { createApp } from '@api/app'
import type { CardItem, InvoiceLine, InvoiceTotal } from '@api/modules/ledger'
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

describe('GET /cards/:cardId/invoices/:invoiceId/lines', () => {
  async function entry(body: object): Promise<string> {
    const response = await owner.post(`${workspacePath}/entries`, body)
    return ((await response.json()) as { entryId: string }).entryId
  }

  it('lists the charges and payments of one invoice, as the card statement shows them', async () => {
    const created = await createCard(owner, 'Card L')
    const { accountId: lineCardId } = (await created.json()) as { accountId: string }
    const purchase = {
      entryType: 'card_purchase',
      occurredOn: '2026-10-05',
      cardAccountId: lineCardId,
      categoryId,
    }
    await entry({
      ...purchase,
      description: 'Geladeira',
      amountCents: 300_000,
      installmentCount: 3,
    })
    await entry({ ...purchase, description: 'Farmácia', amountCents: 5_000 })
    const deleted = await entry({ ...purchase, description: 'Engano', amountCents: 9_900 })
    await owner.del(`${workspacePath}/entries/${deleted}`)

    const invoices = (await (
      await owner.get(`${workspacePath}/cards/${lineCardId}/invoices`)
    ).json()) as InvoiceTotal[]
    const first = invoices[0]
    await entry({
      entryType: 'invoice_payment',
      occurredOn: '2026-10-06',
      description: 'Pagamento parcial',
      amountCents: 50_000,
      cardAccountId: lineCardId,
      invoiceId: first?.invoiceId,
      paidFromAccountId: checkingAccountId,
    })

    const response = await viewer.get(
      `${workspacePath}/cards/${lineCardId}/invoices/${first?.invoiceId}/lines`,
    )
    expect(response.status).toBe(200)
    const lines = (await response.json()) as InvoiceLine[]
    expect(
      lines.map((line) => [
        line.description,
        line.installmentNo,
        line.installmentCount,
        line.amountCents,
      ]),
    ).toEqual([
      ['Geladeira', 1, 3, 100_000],
      ['Farmácia', 1, 1, 5_000],
      ['Pagamento parcial', null, 1, -50_000],
    ])
  })

  it('answers 404 for an invoice of another card and for malformed ids', async () => {
    const created = await createCard(owner, 'Card M')
    const { accountId: otherCardId } = (await created.json()) as { accountId: string }
    await owner.post(`${workspacePath}/entries`, {
      entryType: 'card_purchase',
      occurredOn: '2026-10-05',
      description: 'Livro',
      amountCents: 4_000,
      cardAccountId: otherCardId,
      categoryId,
    })
    const [invoice] = (await (
      await owner.get(`${workspacePath}/cards/${otherCardId}/invoices`)
    ).json()) as InvoiceTotal[]

    const cardsList = await cards()
    const anotherCard = cardsList.find((card) => card.accountId !== otherCardId)
    for (const path of [
      `${anotherCard?.accountId}/invoices/${invoice?.invoiceId}`,
      `${otherCardId}/invoices/not-a-uuid`,
    ]) {
      const response = await owner.get(`${workspacePath}/cards/${path}/lines`)
      expect([response.status, await codeOf(response)]).toEqual([404, 'INVOICE_NOT_FOUND'])
    }
  })
})
