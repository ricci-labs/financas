import { createApp } from '@api/app'
import type { AttachmentItem } from '@api/modules/attachments'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import { createMemoryFileStorage } from '@api/testing/storage'
import type { SessionRequests } from '@api/testing/testing.types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const files = createMemoryFileStorage()
const FILE_MAX_BYTES = 2048
const app = createApp(
  testAppDeps({ db: databases.app, fileStorage: files.storage, fileMaxBytes: FILE_MAX_BYTES }),
)
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'
const JPEG_START = [0xff, 0xd8, 0xff, 0xe0]

let owner: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let outsider: SessionRequests
let workspaceId: string
let outsiderPath: string
let workspacePath: string
let checkingId: string
let groceriesId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'files-owner')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'files-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'files-viewer')
  const outsiderSession = await loggedInUser(app, databases.app, fixtures.runId, 'files-outsider')
  workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Files')).workspaceId
  const outside = await fixtures.createWorkspaceOwnedBy(outsiderSession.userId, 'Outside')
  outsiderPath = `/api/workspaces/${outside.workspaceId}`
  for (const [session, role] of [
    [memberSession, 'member'],
    [viewerSession, 'viewer'],
  ] as const) {
    await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, session.userId, role)
  }
  owner = requestsAs(app, ownerSession)
  member = requestsAs(app, memberSession)
  viewer = requestsAs(app, viewerSession)
  outsider = requestsAs(app, outsiderSession)
  workspacePath = `/api/workspaces/${workspaceId}`
  checkingId = await idOf(
    owner.post(`${workspacePath}/accounts`, { kind: 'checking', name: 'Conta X' }),
  )
  groceriesId = await idOf(
    owner.post(`${workspacePath}/accounts`, { kind: 'expense_category', name: 'Mercado' }),
  )
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function idOf(response: Promise<Response>): Promise<string> {
  const body = (await (await response).json()) as {
    accountId?: string
    entryId?: string
    fileId?: string
    contactId?: string
    chargeId?: string
  }
  const id = body.accountId ?? body.entryId ?? body.fileId ?? body.contactId ?? body.chargeId
  if (!id) {
    throw new Error(`Nothing was created: ${JSON.stringify(body)}`)
  }
  return id
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

function expense(description: string) {
  return {
    entryType: 'expense',
    occurredOn: '2026-10-05',
    description,
    amountCents: 4200,
    paidFromAccountId: checkingId,
    categoryId: groceriesId,
  }
}

function newEntry(description: string): Promise<string> {
  return idOf(member.post(`${workspacePath}/entries`, expense(description)))
}

function jpeg(label: string, extraBytes = 0): Uint8Array {
  const content = new TextEncoder().encode(`${label}-${fixtures.runId}`)
  return new Uint8Array([...JPEG_START, ...content, ...new Array(extraBytes).fill(0)])
}

function formWith(bytes: Uint8Array, name = 'nota.jpg', type = 'image/jpeg'): FormData {
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  return form
}

function attachmentsPath(entryId: string): string {
  return `${workspacePath}/entries/${entryId}/attachments`
}

async function attachmentsOf(entryId: string): Promise<AttachmentItem[]> {
  return (await (await viewer.get(attachmentsPath(entryId))).json()) as AttachmentItem[]
}

function upload(entryId: string, bytes: Uint8Array, name?: string): Promise<string> {
  return idOf(member.postForm(attachmentsPath(entryId), formWith(bytes, name)))
}

describe('POST /entries/:entryId/attachments', () => {
  it('stores a receipt once by its content and lists it on every entry it is attached to', async () => {
    const lunch = await newEntry('Almoço')
    const dinner = await newEntry('Jantar')
    const bytes = jpeg('same-receipt')
    const before = files.stored.size

    const fileId = await upload(lunch, bytes, 'C:\\fotos\\recibo.jpg')
    expect(await upload(dinner, bytes, 'other name.jpg')).toBe(fileId)
    expect(await upload(dinner, bytes)).toBe(fileId)

    expect(files.stored.size).toBe(before + 1)
    expect(files.stored.get(`${workspaceId}/${await sha256Of(bytes)}`)).toEqual(bytes)
    for (const entryId of [lunch, dinner]) {
      expect(await attachmentsOf(entryId)).toEqual([
        {
          fileId,
          name: 'recibo.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: bytes.length,
          attachedAt: expect.any(String),
          attachedByUserId: expect.any(String),
        },
      ])
    }
  })

  it('takes the type from the bytes, never from the name or the declared type', async () => {
    const entryId = await newEntry('Farmácia')
    const html = new TextEncoder().encode('<html><script>alert(1)</script>')
    const disguised = await member.postForm(
      attachmentsPath(entryId),
      formWith(html, 'nota.jpg', 'image/jpeg'),
    )
    expect([disguised.status, await codeOf(disguised)]).toEqual([400, 'FILE_TYPE_NOT_ALLOWED'])

    const pdf = new TextEncoder().encode(`%PDF-1.7 ${fixtures.runId}`)
    const fileId = await idOf(
      member.postForm(attachmentsPath(entryId), formWith(pdf, 'nota.png', 'image/png')),
    )
    expect((await attachmentsOf(entryId)).find((item) => item.fileId === fileId)?.mimeType).toBe(
      'application/pdf',
    )
  })

  it('refuses a missing, empty or too large file', async () => {
    const entryId = await newEntry('Posto')
    const path = attachmentsPath(entryId)

    const missing = await member.post(path, { file: 'not a file' })
    expect([missing.status, await codeOf(missing)]).toEqual([400, 'FILE_REQUIRED'])
    const empty = await member.postForm(path, formWith(new Uint8Array()))
    expect([empty.status, await codeOf(empty)]).toEqual([400, 'FILE_REQUIRED'])

    const tooLarge = await member.postForm(path, formWith(jpeg('large', FILE_MAX_BYTES)))
    expect([tooLarge.status, await codeOf(tooLarge)]).toEqual([413, 'FILE_TOO_LARGE'])
    const hugeBody = await member.postForm(path, formWith(jpeg('huge', 64 * 1024)))
    expect([hugeBody.status, await codeOf(hugeBody)]).toEqual([413, 'PAYLOAD_TOO_LARGE'])
    expect(await attachmentsOf(entryId)).toEqual([])
  })

  it('accepts files larger than the usual request body limit, up to FILE_MAX_BYTES', async () => {
    const roomy = createApp(
      testAppDeps({ db: databases.app, fileStorage: files.storage, fileMaxBytes: 300 * 1024 }),
    )
    const session = await loggedInUser(roomy, databases.app, fixtures.runId, 'files-roomy')
    await addMemberWithSystemRole(
      databases.app,
      databases.owner,
      workspaceId,
      session.userId,
      'member',
    )
    const response = await requestsAs(roomy, session).postForm(
      attachmentsPath(await newEntry('Nota grande')),
      formWith(jpeg('roomy', 200 * 1024)),
    )
    expect(response.status).toBe(201)
  })

  it('needs attachments:create and an active entry of this workspace', async () => {
    const entryId = await newEntry('Padaria')
    const refused = await viewer.postForm(attachmentsPath(entryId), formWith(jpeg('viewer')))
    expect(refused.status).toBe(403)

    for (const unknown of ['not-a-uuid', UNKNOWN_ID]) {
      const response = await member.postForm(attachmentsPath(unknown), formWith(jpeg('unknown')))
      expect([response.status, await codeOf(response)]).toEqual([404, 'ENTRY_NOT_FOUND'])
    }

    await member.del(`${workspacePath}/entries/${entryId}`)
    const trashed = await member.postForm(attachmentsPath(entryId), formWith(jpeg('trashed')))
    expect([trashed.status, await codeOf(trashed)]).toEqual([404, 'ENTRY_NOT_FOUND'])
  })
})

describe('GET /files/:fileId', () => {
  it('sends the bytes inline in a sandbox, only to members of the workspace', async () => {
    const bytes = jpeg('download')
    const fileId = await upload(await newEntry('Mercado'), bytes, 'nota "fiscal" ção.jpg')

    const response = await viewer.get(`${workspacePath}/files/${fileId}`)
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'content-type': 'image/jpeg',
      'content-disposition': `inline; filename="nota _fiscal_ __o.jpg"; filename*=UTF-8''nota%20%22fiscal%22%20%C3%A7%C3%A3o.jpg`,
      'content-security-policy': 'sandbox',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    })

    const otherWorkspace = await outsider.get(`${outsiderPath}/files/${fileId}`)
    expect([otherWorkspace.status, await codeOf(otherWorkspace)]).toEqual([404, 'FILE_NOT_FOUND'])
    for (const unknown of ['not-a-uuid', UNKNOWN_ID]) {
      const missing = await viewer.get(`${workspacePath}/files/${unknown}`)
      expect([missing.status, await codeOf(missing)]).toEqual([404, 'FILE_NOT_FOUND'])
    }
  })
})

describe('DELETE /entries/:entryId/attachments/:fileId', () => {
  it('detaches a file, and trashes it only when nothing else holds it', async () => {
    const first = await newEntry('Uber')
    const second = await newEntry('Uber volta')
    const bytes = jpeg('detach')
    const fileId = await upload(first, bytes)
    await upload(second, bytes)
    const filePath = `${workspacePath}/files/${fileId}`

    expect((await member.del(`${attachmentsPath(first)}/${fileId}`)).status).toBe(403)
    expect((await owner.del(`${attachmentsPath(first)}/${fileId}`)).status).toBe(204)
    expect(await attachmentsOf(first)).toEqual([])
    expect((await viewer.get(filePath)).status).toBe(200)

    expect((await owner.del(`${attachmentsPath(second)}/${fileId}`)).status).toBe(204)
    const trashed = await viewer.get(filePath)
    expect([trashed.status, await codeOf(trashed)]).toEqual([404, 'FILE_NOT_FOUND'])

    const again = await owner.del(`${attachmentsPath(second)}/${fileId}`)
    expect([again.status, await codeOf(again)]).toEqual([404, 'ATTACHMENT_NOT_FOUND'])

    expect(await upload(first, bytes)).toBe(fileId)
    expect((await viewer.get(filePath)).status).toBe(200)
  })
})

describe('editing an entry', () => {
  it('moves its attachments to the entry that replaces it', async () => {
    const entryId = await newEntry('Feira')
    const fileId = await upload(entryId, jpeg('replaced'))
    const replacement = await idOf(
      member.put(`${workspacePath}/entries/${entryId}`, expense('Feira grande')),
    )

    expect((await attachmentsOf(replacement)).map((item) => item.fileId)).toEqual([fileId])
    const old = await viewer.get(attachmentsPath(entryId))
    expect([old.status, await codeOf(old)]).toEqual([404, 'ENTRY_NOT_FOUND'])
  })
})

async function sha256Of(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Buffer.from(digest).toString('hex')
}

describe('charge attachments', () => {
  it('hold payment receipts, and keep a file alive while a charge still holds it', async () => {
    const contactId = await idOf(member.post(`${workspacePath}/contacts`, { name: 'Contact J' }))
    const entryId = await idOf(
      member.post(`${workspacePath}/entries`, {
        ...expense('Jantar'),
        occurredOn: '2026-01-05',
        shares: [{ contactId, amountCents: 2100 }],
      }),
    )
    const chargeId = await idOf(member.post(`${workspacePath}/contacts/${contactId}/charges`, {}))
    const chargePath = `${workspacePath}/charges/${chargeId}/attachments`
    const bytes = jpeg('pix-receipt')

    const fileId = await idOf(member.postForm(chargePath, formWith(bytes, 'pix.jpg')))
    expect(await upload(entryId, bytes)).toBe(fileId)
    expect(await (await viewer.get(chargePath)).json()).toEqual([
      expect.objectContaining({ fileId, name: 'pix.jpg', mimeType: 'image/jpeg' }),
    ])

    expect((await owner.del(`${attachmentsPath(entryId)}/${fileId}`)).status).toBe(204)
    expect((await viewer.get(`${workspacePath}/files/${fileId}`)).status).toBe(200)
    expect((await owner.del(`${chargePath}/${fileId}`)).status).toBe(204)
    expect((await viewer.get(`${workspacePath}/files/${fileId}`)).status).toBe(404)

    for (const unknown of ['not-a-uuid', UNKNOWN_ID]) {
      const response = await member.postForm(
        `${workspacePath}/charges/${unknown}/attachments`,
        formWith(jpeg('no-charge')),
      )
      expect([response.status, await codeOf(response)]).toEqual([404, 'CHARGE_NOT_FOUND'])
    }
  })
})
