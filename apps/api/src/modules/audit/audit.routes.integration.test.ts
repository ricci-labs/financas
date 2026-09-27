import { createApp } from '@api/app'
import { withWorkspace } from '@api/core/db/tx'
import { runInOperation } from '@api/core/observability/operation-context'
import { type AuditItem, recordAudit } from '@api/modules/audit'
import { auditLog } from '@api/modules/audit/audit.table'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import type { Page } from '@financas/shared'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const app = createApp(testAppDeps({ db: databases.app }))

let owner: SessionRequests
let admin: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let ownerId: string
let memberId: string
let workspaceId: string
let otherWorkspaceId: string
let workspacePath: string
let checkingId: string
let groceriesId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'audit-owner')
  const adminSession = await loggedInUser(app, databases.app, fixtures.runId, 'audit-admin')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'audit-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'audit-viewer')
  workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Audit')).workspaceId
  otherWorkspaceId = (await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Other'))
    .workspaceId
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
  ownerId = ownerSession.userId
  memberId = memberSession.userId
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
  const body = (await (await response).json()) as { accountId?: string; entryId?: string }
  const id = body.accountId ?? body.entryId
  if (!id) {
    throw new Error(`Nothing was created: ${JSON.stringify(body)}`)
  }
  return id
}

function expense(description: string, amountCents = 4200) {
  return {
    entryType: 'expense',
    occurredOn: '2026-10-05',
    description,
    amountCents,
    paidFromAccountId: checkingId,
    categoryId: groceriesId,
  }
}

async function auditAt(query: string, as = owner): Promise<Page<AuditItem>> {
  const response = await as.get(`${workspacePath}/audit${query}`)
  expect(response.status).toBe(200)
  return (await response.json()) as Page<AuditItem>
}

describe('entries in the audit log', () => {
  it('record who did what, from where, under which trace, with the rows before and after', async () => {
    const created = await member.post(`${workspacePath}/entries`, expense('Padaria'))
    const entryId = await idOf(Promise.resolve(created))
    await member.patch(`${workspacePath}/entries/${entryId}`, { description: 'Padaria nova' })
    const replacementId = await idOf(
      member.put(`${workspacePath}/entries/${entryId}`, expense('Padaria nova', 5000)),
    )
    await owner.del(`${workspacePath}/entries/${replacementId}`, { reason: 'Duplicado' })
    await owner.post(`${workspacePath}/entries/${replacementId}/restore`)

    const events = (await auditAt('?tableName=journal_entries')).items
    expect(
      events.slice(0, 5).map((event) => [event.action, event.rowId, event.actorUserId]),
    ).toEqual([
      ['restore', replacementId, ownerId],
      ['delete', replacementId, ownerId],
      ['update', replacementId, memberId],
      ['update', entryId, memberId],
      ['create', entryId, memberId],
    ])
    const [restore, deletion, replacement, edit, creation] = events
    expect(creation).toMatchObject({
      source: 'web',
      traceId: created.headers.get('X-Request-Id'),
      before: null,
      after: {
        id: entryId,
        description: 'Padaria',
        postings: [
          expect.objectContaining({ accountId: groceriesId, amountCents: 4200 }),
          expect.objectContaining({ accountId: checkingId, amountCents: -4200 }),
        ],
      },
    })
    expect([edit?.before, edit?.after]).toMatchObject([
      { description: 'Padaria' },
      { description: 'Padaria nova' },
    ])
    expect([replacement?.before, replacement?.after]).toMatchObject([
      { id: entryId, description: 'Padaria nova' },
      { id: replacementId, replacesEntryId: entryId },
    ])
    expect([deletion?.before, deletion?.after]).toMatchObject([
      { deletedAt: null },
      { deleteReason: 'Duplicado', deletedByUserId: ownerId },
    ])
    expect(restore?.after).toMatchObject({ deletedAt: null })
  })
})

describe('GET /audit', () => {
  it('is for owners and admins, filters by row and pages newest first', async () => {
    const entryId = await idOf(member.post(`${workspacePath}/entries`, expense('Feira')))
    for (const description of ['Feira 2', 'Feira 3']) {
      await member.patch(`${workspacePath}/entries/${entryId}`, { description })
    }
    expect((await member.get(`${workspacePath}/audit`)).status).toBe(403)
    expect((await viewer.get(`${workspacePath}/audit`)).status).toBe(403)

    const first = await auditAt(`?rowId=${entryId}&limit=2`, admin)
    expect(
      first.items.map((event) => (event.after as { description: string }).description),
    ).toEqual(['Feira 3', 'Feira 2'])
    const second = await auditAt(
      `?rowId=${entryId}&limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      admin,
    )
    expect(second.items.map((event) => event.action)).toEqual(['create'])
    expect(second.nextCursor).toBeNull()

    const invalid = await owner.get(`${workspacePath}/audit?rowId=not-a-uuid`)
    expect(invalid.status).toBe(400)
  })
})

describe('audit_log', () => {
  it('can only be appended to and read by the app, and only in its own workspace', async () => {
    await runInOperation({ traceId: 'job-trace', source: 'job' }, () =>
      withWorkspace(databases.app, workspaceId, (tx) =>
        recordAudit(tx, {
          workspaceId,
          actorUserId: null,
          action: 'update',
          tableName: 'workspace_settings',
          rowId: workspaceId,
        }),
      ),
    )
    expect((await auditAt(`?rowId=${workspaceId}`)).items[0]).toMatchObject({
      source: 'job',
      traceId: 'job-trace',
      actorUserId: null,
    })

    for (const statement of [
      sql`update audit_log set action = 'create'`,
      sql`delete from audit_log`,
      sql`truncate audit_log`,
    ]) {
      await expect(
        withWorkspace(databases.app, workspaceId, (tx) => tx.execute(statement)),
      ).rejects.toMatchObject({ cause: { code: '42501' } })
    }
    const visibleElsewhere = await withWorkspace(databases.app, otherWorkspaceId, (tx) =>
      tx.select({ id: auditLog.id }).from(auditLog),
    )
    expect(visibleElsewhere).toEqual([])
    await expect(
      withWorkspace(databases.app, otherWorkspaceId, (tx) =>
        recordAudit(tx, {
          workspaceId,
          actorUserId: null,
          action: 'update',
          tableName: 'workspace_settings',
          rowId: workspaceId,
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } })
  })
})
