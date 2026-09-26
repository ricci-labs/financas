import { createApp } from '@api/app'
import type { ContactItem } from '@api/modules/contacts'
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
let contactsPath: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'contacts-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'contacts-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'contacts-viewer')
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Contacts')
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  contactsPath = `/api/workspaces/${workspaceId}/contacts`
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function created(response: Promise<Response>): Promise<string> {
  return ((await (await response).json()) as { contactId: string }).contactId
}

async function contacts(): Promise<ContactItem[]> {
  return (await (await viewer.get(contactsPath)).json()) as ContactItem[]
}

describe('contacts', () => {
  it('need only a name, and list with their phone for charges', async () => {
    const onlyName = await created(member.post(contactsPath, { name: 'Contact J' }))
    const withPhone = await created(
      member.post(contactsPath, {
        name: 'Contact M',
        phoneE164: '+5511900001111',
        notes: 'Colega',
      }),
    )
    const listed = await contacts()
    expect(listed.find((contact) => contact.id === onlyName)).toEqual({
      id: onlyName,
      name: 'Contact J',
      phoneE164: null,
      pixKey: null,
      notes: null,
      isOptedOut: false,
      isArchived: false,
    })
    expect(listed.find((contact) => contact.id === withPhone)).toMatchObject({
      phoneE164: '+5511900001111',
      notes: 'Colega',
    })
  })

  it('refuse a viewer, a bad phone, a blank name and a phone already taken', async () => {
    expect((await viewer.post(contactsPath, { name: 'X' })).status).toBe(403)
    for (const body of [
      { name: 'X', phoneE164: '11 90000-1111' },
      { name: '  ' },
      { name: 'X', extra: 1 },
    ]) {
      const response = await member.post(contactsPath, body)
      expect([response.status, await codeOf(response)]).toEqual([400, 'CONTACT_INVALID'])
    }
    await created(member.post(contactsPath, { name: 'Contact P', phoneE164: '+5511900002222' }))
    const taken = await member.post(contactsPath, { name: 'Outro', phoneE164: '+5511900002222' })
    expect([taken.status, await codeOf(taken)]).toEqual([409, 'CONTACT_PHONE_TAKEN'])
  })

  it('change only what is sent, and remember when a contact opted out', async () => {
    const contactId = await created(
      member.post(contactsPath, { name: 'Contact Q', notes: 'Primo' }),
    )
    const path = `${contactsPath}/${contactId}`
    expect((await member.patch(path, { phoneE164: '+5511900003333' })).status).toBe(204)
    expect((await member.patch(path, { isOptedOut: true })).status).toBe(204)
    expect((await contacts()).find((contact) => contact.id === contactId)).toMatchObject({
      name: 'Contact Q',
      notes: 'Primo',
      phoneE164: '+5511900003333',
      isOptedOut: true,
    })
    await member.patch(path, { isOptedOut: false })
    expect((await contacts()).find((contact) => contact.id === contactId)?.isOptedOut).toBe(false)
    const nothing = await member.patch(path, {})
    expect([nothing.status, await codeOf(nothing)]).toEqual([400, 'CONTACT_INVALID'])
  })

  it('are deleted by roles with contacts:delete, freeing their phone', async () => {
    const contactId = await created(
      member.post(contactsPath, { name: 'Contact R', phoneE164: '+5511900004444' }),
    )
    expect((await member.del(`${contactsPath}/${contactId}`)).status).toBe(403)
    expect((await owner.del(`${contactsPath}/${contactId}`, { reason: 'Mudou' })).status).toBe(204)
    expect((await contacts()).map((contact) => contact.id)).not.toContain(contactId)
    expect(
      (await member.post(contactsPath, { name: 'Contact R2', phoneE164: '+5511900004444' })).status,
    ).toBe(201)
    for (const id of [contactId, UNKNOWN_ID, 'nope']) {
      const response = await owner.patch(`${contactsPath}/${id}`, { name: 'X' })
      expect([response.status, await codeOf(response)]).toEqual([404, 'CONTACT_NOT_FOUND'])
    }
  })
})
