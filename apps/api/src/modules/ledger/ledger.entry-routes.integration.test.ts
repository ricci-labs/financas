import { createApp } from '@api/app'
import type { EntryItem, InvoiceTotal } from '@api/modules/ledger'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import type { Page } from '@financas/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let owner: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let workspacePath: string
let entriesPath: string
let checkingId: string
let groceriesId: string
let salaryId: string
let cardId: string
let foreignCategoryId: string
let ownerId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'entries-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'entries-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'entries-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Entries')
  const foreign = await fixtures.createWorkspaceOwnedBy(memberSession.userId, 'Foreign')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  ownerId = ownerSession.userId
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  workspacePath = `/api/workspaces/${workspaceId}`
  entriesPath = `${workspacePath}/entries`
  checkingId = await created(
    owner.post(`${workspacePath}/accounts`, { kind: 'checking', name: 'Conta X' }),
  )
  groceriesId = await created(
    owner.post(`${workspacePath}/accounts`, { kind: 'expense_category', name: 'Mercado' }),
  )
  salaryId = await created(
    owner.post(`${workspacePath}/accounts`, {
      kind: 'income_category',
      name: 'Salário',
      incomeNature: 'fixed',
    }),
  )
  cardId = await created(
    owner.post(`${workspacePath}/cards`, { name: 'Card X', closingDay: 3, dueDay: 10 }),
  )
  foreignCategoryId = await created(
    member.post(`/api/workspaces/${foreign.workspaceId}/accounts`, {
      kind: 'expense_category',
      name: 'Alheia',
    }),
  )
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

function expense(description: string, occurredOn = '2026-10-05', amountCents = 8750) {
  return {
    entryType: 'expense',
    occurredOn,
    description,
    amountCents,
    paidFromAccountId: checkingId,
    categoryId: groceriesId,
  }
}

async function listed(query = ''): Promise<EntryItem[]> {
  return (await pageAt(`${entriesPath}${query}`)).items
}

async function pageAt(path: string, as = viewer): Promise<Page<EntryItem>> {
  return (await (await as.get(path)).json()) as Page<EntryItem>
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('POST /entries', () => {
  it('records an expense as balanced postings, listed for anyone who may view', async () => {
    const response = await member.post(entriesPath, expense('Feira'))
    expect(response.status).toBe(201)
    const { entryId } = (await response.json()) as { entryId: string }

    const entry = (await listed()).find((item) => item.id === entryId)
    expect(entry).toMatchObject({ entryType: 'expense', description: 'Feira', source: 'web' })
    expect(entry?.postings.map((posting) => posting.amountCents).sort()).toEqual([-8750, 8750])
  })

  it('splits a card purchase into installments on the right invoices', async () => {
    const response = await owner.post(entriesPath, {
      entryType: 'card_purchase',
      occurredOn: '2026-10-05',
      description: 'Geladeira',
      amountCents: 300_000,
      installmentCount: 3,
      cardAccountId: cardId,
      categoryId: groceriesId,
    })
    const { entryId } = (await response.json()) as { entryId: string }

    const entry = (await listed()).find((item) => item.id === entryId)
    const onTheCard = entry?.postings.filter((posting) => posting.accountId === cardId) ?? []
    expect(onTheCard.map((posting) => posting.installmentNo)).toEqual([1, 2, 3])
    expect(new Set(onTheCard.map((posting) => posting.invoiceId)).size).toBe(3)
    const invoices = (await (
      await viewer.get(`${workspacePath}/cards/${cardId}/invoices`)
    ).json()) as InvoiceTotal[]
    expect(invoices.map((invoice) => invoice.totalCents)).toEqual([100_000, 100_000, 100_000])
  })

  it('refuses a viewer, an invalid amount and an account from another workspace', async () => {
    expect((await viewer.post(entriesPath, expense('Nope'))).status).toBe(403)

    const zero = await owner.post(entriesPath, expense('Zero', '2026-10-05', 0))
    expect([zero.status, await codeOf(zero)]).toEqual([400, 'ENTRY_INVALID'])

    const foreign = await owner.post(entriesPath, {
      ...expense('Alheia'),
      categoryId: foreignCategoryId,
    })
    expect([foreign.status, await codeOf(foreign)]).toEqual([400, 'ACCOUNT_NOT_AVAILABLE'])
  })
})

describe('GET /entries', () => {
  it('filters by period and account, newest first, up to the limit', async () => {
    await owner.post(entriesPath, expense('Setembro', '2026-09-20'))
    await owner.post(entriesPath, expense('Novembro', '2026-11-02'))
    await owner.post(entriesPath, {
      entryType: 'income',
      occurredOn: '2026-10-06',
      description: 'Salário A',
      amountCents: 500_000,
      receivedInAccountId: checkingId,
      categoryId: salaryId,
    })

    const october = await listed('?from=2026-10-01&to=2026-10-31')
    expect(october.every((item) => item.occurredOn.startsWith('2026-10'))).toBe(true)
    expect(october.map((item) => item.occurredOn)).toEqual(
      [...october.map((item) => item.occurredOn)].sort().reverse(),
    )

    const salaryOnly = await listed(`?accountId=${salaryId}`)
    expect(salaryOnly.map((item) => item.description)).toEqual(['Salário A'])

    expect(await listed('?limit=1')).toHaveLength(1)
  })

  it('walks every entry page by page, ties on the same day included, each once', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerId, 'Paging')
    const path = `/api/workspaces/${workspaceId}/entries`
    const bank = await created(
      owner.post(`/api/workspaces/${workspaceId}/accounts`, { kind: 'checking', name: 'Conta Y' }),
    )
    const food = await created(
      owner.post(`/api/workspaces/${workspaceId}/accounts`, {
        kind: 'expense_category',
        name: 'Comida',
      }),
    )
    for (const [description, occurredOn] of [
      ['A', '2026-10-01'],
      ['B', '2026-10-02'],
      ['C', '2026-10-02'],
      ['D', '2026-10-02'],
      ['E', '2026-10-03'],
    ]) {
      await owner.post(path, {
        entryType: 'expense',
        occurredOn,
        description,
        amountCents: 1000,
        paidFromAccountId: bank,
        categoryId: food,
      })
    }
    const everything = (await pageAt(path, owner)).items.map((item) => item.id)

    const walked: string[] = []
    let page = await pageAt(`${path}?limit=2`, owner)
    walked.push(...page.items.map((item) => item.id))
    while (page.nextCursor) {
      page = await pageAt(`${path}?limit=2&cursor=${page.nextCursor}`, owner)
      walked.push(...page.items.map((item) => item.id))
    }

    expect(everything).toHaveLength(5)
    expect(walked).toEqual(everything)
    expect((await pageAt(`${path}?limit=5`, owner)).nextCursor).toBeNull()
  })

  it('refuses a malformed query', async () => {
    const response = await viewer.get(`${entriesPath}?from=2026-10-31&to=2026-10-01`)
    expect([response.status, await codeOf(response)]).toEqual([400, 'ENTRY_QUERY_INVALID'])
    const cursor = await viewer.get(`${entriesPath}?cursor=2026-10-01_not-an-id`)
    expect([cursor.status, await codeOf(cursor)]).toEqual([400, 'ENTRY_QUERY_INVALID'])
  })
})

describe('PATCH and PUT /entries/:entryId', () => {
  it('changes the description, and replaces an entry with a new one that points back', async () => {
    const entryId = await created(owner.post(entriesPath, expense('Padaria')))
    expect(
      (await member.patch(`${entriesPath}/${entryId}`, { description: 'Padaria da esquina' }))
        .status,
    ).toBe(204)

    const replaced = await member.put(
      `${entriesPath}/${entryId}`,
      expense('Padaria da esquina', '2026-10-07', 1200),
    )
    expect(replaced.status).toBe(201)
    const { entryId: newId } = (await replaced.json()) as { entryId: string }

    const entries = await listed()
    expect(entries.map((item) => item.id)).not.toContain(entryId)
    expect(entries.find((item) => item.id === newId)).toMatchObject({
      replacesEntryId: entryId,
      description: 'Padaria da esquina',
    })
  })
})

describe('DELETE and restore /entries/:entryId', () => {
  it('moves an entry to the trash and back, refusing a viewer and a second delete', async () => {
    const entryId = await created(owner.post(entriesPath, expense('Farmácia')))
    expect((await viewer.del(`${entriesPath}/${entryId}`)).status).toBe(403)

    expect((await member.del(`${entriesPath}/${entryId}`, { reason: 'Duplicado' })).status).toBe(
      204,
    )
    expect((await listed()).map((item) => item.id)).not.toContain(entryId)

    const again = await member.del(`${entriesPath}/${entryId}`)
    expect([again.status, await codeOf(again)]).toEqual([409, 'ENTRY_ALREADY_DELETED'])

    expect((await member.post(`${entriesPath}/${entryId}/restore`)).status).toBe(204)
    expect((await listed()).map((item) => item.id)).toContain(entryId)
  })

  it('answers 404 for a malformed or unknown entry id', async () => {
    for (const entryId of ['not-a-uuid', UNKNOWN_ID]) {
      const response = await owner.patch(`${entriesPath}/${entryId}`, { description: 'x' })
      expect([response.status, await codeOf(response)]).toEqual([404, 'ENTRY_NOT_FOUND'])
    }
  })
})
