import { createApp } from '@api/app'
import type { LedgerAccountItem, TrashedAccount } from '@api/modules/ledger'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let owner: ReturnType<typeof requestsAs>
let member: ReturnType<typeof requestsAs>
let viewer: ReturnType<typeof requestsAs>
let accountsPath: string
let foreignAccountsPath: string
let ownerId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'accounts-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'accounts-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'accounts-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Accounts')
  const foreign = await fixtures.createWorkspaceOwnedBy(memberSession.userId, 'Foreign')
  await addMemberWithSystemRole(
    databases.app,
    databases.owner,
    workspaceId,
    memberSession.userId,
    'member',
  )
  await addMemberWithSystemRole(
    databases.app,
    databases.owner,
    workspaceId,
    viewerSession.userId,
    'viewer',
  )
  owner = requestsAs(app, ownerSession)
  ownerId = ownerSession.userId
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  accountsPath = `/api/workspaces/${workspaceId}/accounts`
  foreignAccountsPath = `/api/workspaces/${foreign.workspaceId}/accounts`
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function listed(requests: ReturnType<typeof requestsAs>, path = accountsPath) {
  return (await (await requests.get(path)).json()) as LedgerAccountItem[]
}

async function createCategory(name: string) {
  const response = await owner.post(accountsPath, { kind: 'expense_category', name })
  return ((await response.json()) as { accountId: string }).accountId
}

function codeOf(response: Response) {
  return response.json().then((body) => (body as { error: { code: string } }).error.code)
}

describe('GET /accounts', () => {
  it('lists the workspace accounts, system ones included, to anyone who may view them', async () => {
    const accounts = await listed(viewer)
    expect(accounts.some((account) => account.isSystem)).toBe(true)
    expect(accounts[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), kind: expect.any(String) }),
    )
  })
})

describe('POST /accounts', () => {
  it('creates an account that shows up in the list', async () => {
    const response = await owner.post(accountsPath, {
      kind: 'expense_category',
      name: 'Mercado',
      color: '#22aa66',
    })
    expect(response.status).toBe(201)
    const { accountId } = (await response.json()) as { accountId: string }
    expect(await listed(owner)).toContainEqual(
      expect.objectContaining({
        id: accountId,
        name: 'Mercado',
        color: '#22aa66',
        isSystem: false,
      }),
    )
  })

  it('refuses roles without accounts:create, invalid bodies and taken names', async () => {
    await createCategory('Farmácia')
    const body = { kind: 'expense_category', name: 'Outra' }
    expect((await member.post(accountsPath, body)).status).toBe(403)
    expect((await viewer.post(accountsPath, body)).status).toBe(403)

    const invalid = await owner.post(accountsPath, { kind: 'expense_category', name: '' })
    expect([invalid.status, await codeOf(invalid)]).toEqual([400, 'ACCOUNT_INVALID'])

    const taken = await owner.post(accountsPath, { kind: 'expense_category', name: 'Farmácia' })
    expect([taken.status, await codeOf(taken)]).toEqual([409, 'ACCOUNT_NAME_TAKEN'])
  })
})

describe('PATCH /accounts/:accountId', () => {
  it('renames an account', async () => {
    const accountId = await createCategory('Padaria')
    expect(
      (await owner.patch(`${accountsPath}/${accountId}`, { name: 'Padaria e café' })).status,
    ).toBe(204)
    expect(await listed(owner)).toContainEqual(
      expect.objectContaining({ id: accountId, name: 'Padaria e café' }),
    )
  })

  it('answers 404 for a malformed id, an unknown one and one from another workspace', async () => {
    const [foreignAccount] = await listed(member, foreignAccountsPath)
    for (const accountId of ['not-a-uuid', UNKNOWN_ID, foreignAccount?.id]) {
      const response = await owner.patch(`${accountsPath}/${accountId}`, { name: 'Nope' })
      expect([response.status, await codeOf(response)]).toEqual([404, 'ACCOUNT_NOT_FOUND'])
    }
  })
})

describe('archive and unarchive', () => {
  it('sets and clears archivedAt', async () => {
    const accountId = await createCategory('Academia')
    expect((await owner.post(`${accountsPath}/${accountId}/archive`)).status).toBe(204)
    const archived = (await listed(owner)).find((account) => account.id === accountId)
    expect(archived?.archivedAt).not.toBeNull()

    expect((await owner.post(`${accountsPath}/${accountId}/unarchive`)).status).toBe(204)
    const active = (await listed(owner)).find((account) => account.id === accountId)
    expect(active?.archivedAt).toBeNull()
  })
})

describe('DELETE and restore', () => {
  it('moves an account to the trash with a reason, and brings it back', async () => {
    const accountId = await createCategory('Assinaturas')
    expect((await member.del(`${accountsPath}/${accountId}`)).status).toBe(403)

    const deleted = await owner.del(`${accountsPath}/${accountId}`, { reason: 'Duplicada' })
    expect(deleted.status).toBe(204)
    expect((await listed(owner)).map((account) => account.id)).not.toContain(accountId)

    const again = await owner.del(`${accountsPath}/${accountId}`)
    expect([again.status, await codeOf(again)]).toEqual([409, 'ACCOUNT_DELETED'])

    expect((await owner.post(`${accountsPath}/${accountId}/restore`)).status).toBe(204)
    expect((await listed(owner)).map((account) => account.id)).toContain(accountId)
  })

  it('shows deleted accounts in the trash, with who and why, until restored', async () => {
    const accountId = await createCategory('Streaming')
    await owner.del(`${accountsPath}/${accountId}`, { reason: 'Cancelada' })

    expect((await member.get(`${accountsPath}/trash`)).status).toBe(403)
    const trash = (await (await owner.get(`${accountsPath}/trash`)).json()) as TrashedAccount[]
    expect(trash.find((account) => account.id === accountId)).toMatchObject({
      name: 'Streaming',
      kind: 'expense_category',
      deletedByUserId: ownerId,
      deleteReason: 'Cancelada',
      deletedAt: expect.any(String),
    })
    expect(trash.map((account) => account.id)).not.toContain(await createCategory('Ativa'))

    await owner.post(`${accountsPath}/${accountId}/restore`)
    const afterRestore = (await (
      await owner.get(`${accountsPath}/trash`)
    ).json()) as TrashedAccount[]
    expect(afterRestore.map((account) => account.id)).not.toContain(accountId)
  })

  it('accepts a delete without a body', async () => {
    const accountId = await createCategory('Sem motivo')
    expect((await owner.del(`${accountsPath}/${accountId}`)).status).toBe(204)
  })
})
