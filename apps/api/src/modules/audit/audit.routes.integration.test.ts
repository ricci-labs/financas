import { createApp } from '@api/app'
import { withWorkspace } from '@api/core/db/tx'
import { runInOperation } from '@api/core/observability/operation-context'
import { type AuditItem, recordAudit } from '@api/modules/audit'
import { auditLog } from '@api/modules/audit/audit.table'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import type { SessionRequests } from '@api/testing/testing.types'
import { addDays, type Page, todayIn } from '@financas/shared'
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
  const body = (await (await response).json()) as Record<string, string | undefined>
  const id =
    body.accountId ??
    body.entryId ??
    body.contactId ??
    body.chargeId ??
    body.ruleId ??
    body.goalId ??
    body.holidayId ??
    body.fileId
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
    await runInOperation({ traceId: 'job-trace', source: 'job', actorUserId: null }, () =>
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
      tx.select({ workspaceId: auditLog.workspaceId }).from(auditLog),
    )
    expect(new Set(visibleElsewhere.map((row) => row.workspaceId))).toEqual(
      new Set([otherWorkspaceId]),
    )
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

describe('writes across the modules', () => {
  it('each leave an audit event with the logged-in member as the actor', async () => {
    const today = todayIn('America/Sao_Paulo', new Date())
    const base = workspacePath
    const expectLatest = async (tableName: string, rowId: string, action: string) => {
      const [event] = (await auditAt(`?tableName=${tableName}&rowId=${rowId}&limit=1`)).items
      expect({ tableName, action: event?.action, actor: event?.actorUserId }).toEqual({
        tableName,
        action,
        actor: ownerId,
      })
      return event
    }
    const ok = async (response: Promise<Response>) =>
      expect((await response).status).toBeLessThan(300)

    const accountId = await idOf(
      owner.post(`${base}/accounts`, { kind: 'savings', name: 'Reserva' }),
    )
    await expectLatest('ledger_accounts', accountId, 'create')
    await ok(owner.patch(`${base}/accounts/${accountId}`, { name: 'Reserva A' }))
    expect((await expectLatest('ledger_accounts', accountId, 'update'))?.after).toMatchObject({
      name: 'Reserva A',
    })
    await ok(owner.post(`${base}/accounts/${accountId}/archive`))
    await expectLatest('ledger_accounts', accountId, 'archive')
    await ok(owner.post(`${base}/accounts/${accountId}/unarchive`))
    await expectLatest('ledger_accounts', accountId, 'unarchive')
    await ok(owner.del(`${base}/accounts/${accountId}`, {}))
    await expectLatest('ledger_accounts', accountId, 'delete')
    await ok(owner.post(`${base}/accounts/${accountId}/restore`))
    await expectLatest('ledger_accounts', accountId, 'restore')

    const cardId = await idOf(
      owner.post(`${base}/cards`, { name: 'Card X', closingDay: 3, dueDay: 10 }),
    )
    await expectLatest('ledger_accounts', cardId, 'create')
    await expectLatest('card_details', cardId, 'create')
    await ok(owner.patch(`${base}/cards/${cardId}`, { dueDay: 12 }))
    await expectLatest('card_details', cardId, 'update')

    const contactId = await idOf(owner.post(`${base}/contacts`, { name: 'Contact J' }))
    await expectLatest('contacts', contactId, 'create')
    await ok(owner.patch(`${base}/contacts/${contactId}`, { notes: 'Colega' }))
    await expectLatest('contacts', contactId, 'update')
    await ok(
      owner.post(`${base}/entries`, {
        ...expense('Jantar'),
        occurredOn: addDays(today, -3),
        shares: [{ contactId, amountCents: 2000 }],
      }),
    )
    const chargeId = await idOf(owner.post(`${base}/contacts/${contactId}/charges`, {}))
    await expectLatest('charges', chargeId, 'create')
    await ok(owner.post(`${base}/charges/${chargeId}/sent`))
    await expectLatest('charges', chargeId, 'update')
    await ok(
      owner.post(`${base}/charges/${chargeId}/payments`, {
        amountCents: 2000,
        receivedInAccountId: checkingId,
        occurredOn: today,
      }),
    )
    const [payment] = (await auditAt('?tableName=charge_payments&limit=1')).items
    expect(payment).toMatchObject({ action: 'create', after: { chargeId, amountCents: 2000 } })
    const other = await idOf(owner.post(`${base}/contacts`, { name: 'Contact K' }))
    await ok(owner.del(`${base}/contacts/${other}`, {}))
    await expectLatest('contacts', other, 'delete')

    const ruleId = await idOf(
      owner.post(`${base}/recurrences`, {
        description: 'Diarista',
        entryType: 'expense',
        amountCents: 4200,
        sourceAccountId: checkingId,
        categoryAccountId: groceriesId,
        schedule: { frequency: 'weekly', startsOn: today },
      }),
    )
    await expectLatest('recurrence_rules', ruleId, 'create')
    await ok(owner.patch(`${base}/recurrences/${ruleId}`, { description: 'Diarista nova' }))
    await expectLatest('recurrence_rules', ruleId, 'update')
    const occurrences = (await (
      await owner.get(`${base}/occurrences?from=${today}&to=${addDays(today, 6)}`)
    ).json()) as { id: string; ruleId: string }[]
    const occurrenceId = occurrences.find((item) => item.ruleId === ruleId)?.id ?? ''
    const occurrencePath = `${base}/occurrences/${occurrenceId}`
    for (const step of ['skip', 'unskip']) {
      await ok(owner.post(`${occurrencePath}/${step}`))
      await expectLatest('planned_occurrences', occurrenceId, 'update')
    }
    await ok(owner.patch(occurrencePath, { amountCents: 4300 }))
    expect(
      (await expectLatest('planned_occurrences', occurrenceId, 'update'))?.after,
    ).toMatchObject({ amountCents: 4300 })
    const paid = await idOf(
      owner.post(`${base}/entries`, { ...expense('Diarista', 4300), occurredOn: today }),
    )
    await ok(owner.post(`${occurrencePath}/match`, { entryId: paid }))
    expect(
      (await expectLatest('planned_occurrences', occurrenceId, 'update'))?.after,
    ).toMatchObject({ matchedEntryId: paid })
    await ok(owner.post(`${occurrencePath}/unmatch`))
    await expectLatest('planned_occurrences', occurrenceId, 'update')
    await ok(owner.del(`${base}/recurrences/${ruleId}`, {}))
    await expectLatest('recurrence_rules', ruleId, 'delete')

    const goalId = await idOf(
      owner.post(`${base}/goals`, { name: 'Viagem', targetCents: 500_000, accountId: checkingId }),
    )
    await expectLatest('goals', goalId, 'create')
    await ok(owner.patch(`${base}/goals/${goalId}`, { targetCents: 600_000 }))
    await expectLatest('goals', goalId, 'update')
    await ok(
      owner.put(`${base}/allocation-steps`, {
        steps: [{ kind: 'fill_goal', goalId }],
      }),
    )
    expect(await expectLatest('allocation_steps', workspaceId, 'update')).toMatchObject({
      before: [],
      after: [expect.objectContaining({ kind: 'fill_goal', goalId })],
    })
    await ok(owner.del(`${base}/goals/${goalId}`, {}))
    await expectLatest('goals', goalId, 'delete')

    const holidayId = await idOf(
      owner.post(`${base}/holidays`, { onDate: '2027-01-25', name: 'Aniversário da cidade' }),
    )
    await expectLatest('workspace_holidays', holidayId, 'create')
    await ok(owner.del(`${base}/holidays/${holidayId}`, {}))
    await expectLatest('workspace_holidays', holidayId, 'delete')

    await ok(
      owner.put(`${base}/budgets/${groceriesId}`, { limitCents: 80_000, fromPeriod: '2026-10' }),
    )
    const [created] = (await auditAt('?tableName=budget_lines&limit=1')).items
    expect(created).toMatchObject({ action: 'create', after: { limitCents: 80_000 } })
    await ok(
      owner.put(`${base}/budgets/${groceriesId}`, { limitCents: 90_000, fromPeriod: '2026-10' }),
    )
    expect(await expectLatest('budget_lines', created?.rowId ?? '', 'update')).toMatchObject({
      before: { limitCents: 80_000 },
      after: { limitCents: 90_000 },
    })

    const form = new FormData()
    form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7])], 'nota.jpg'))
    const fileId = await idOf(owner.postForm(`${base}/entries/${paid}/attachments`, form))
    expect(await expectLatest('entry_attachments', fileId, 'create')).toMatchObject({
      after: { entryId: paid, fileId, name: 'nota.jpg' },
    })
    await ok(owner.del(`${base}/entries/${paid}/attachments/${fileId}`))
    await expectLatest('entry_attachments', fileId, 'delete')
  })
})

describe('workspace, roles, invitations and members', () => {
  it('leave audit events too, with the new user as actor when they join by sign-up', async () => {
    const created = await owner.post('/api/workspaces', { name: 'Audited home' })
    const { workspaceId: homeId } = (await created.json()) as { workspaceId: string }
    const home = `/api/workspaces/${homeId}`
    const auditOf = async (tableName: string, rowId?: string) =>
      (
        (await (
          await owner.get(`${home}/audit?tableName=${tableName}${rowId ? `&rowId=${rowId}` : ''}`)
        ).json()) as Page<AuditItem>
      ).items
    const ok = async (response: Promise<Response>) =>
      expect((await response).status).toBeLessThan(300)

    expect((await auditOf('workspaces', homeId))[0]).toMatchObject({
      action: 'create',
      actorUserId: ownerId,
      after: { id: homeId, name: 'Audited home' },
    })
    expect((await auditOf('memberships'))[0]).toMatchObject({
      action: 'create',
      actorUserId: ownerId,
      after: { userId: ownerId },
    })

    await ok(owner.patch(home, { name: 'Audited house' }))
    expect((await auditOf('workspaces', homeId))[0]).toMatchObject({
      action: 'update',
      before: { name: 'Audited home' },
      after: { name: 'Audited house' },
    })
    await ok(owner.patch(`${home}/settings`, { weekStartsOn: 1 }))
    await ok(
      owner.put(`${home}/settings/pix`, {
        key: 'household@example.test',
        receiverName: 'Casa',
        receiverCity: 'Sao Paulo',
      }),
    )
    expect((await auditOf('workspace_settings', homeId)).map((event) => event.action)).toEqual([
      'update',
      'update',
    ])

    const roleId = (
      (await (
        await owner.post(`${home}/roles`, {
          name: 'Lançador',
          permissions: [
            { module: 'entries', action: 'view' },
            { module: 'entries', action: 'create' },
          ],
        })
      ).json()) as { roleId: string }
    ).roleId
    expect((await auditOf('roles', roleId))[0]).toMatchObject({ action: 'create' })
    await ok(
      owner.patch(`${home}/roles/${roleId}`, {
        permissions: [{ module: 'entries', action: 'view' }],
      }),
    )
    expect((await auditOf('role_permissions', roleId))[0]).toMatchObject({
      action: 'update',
      before: expect.arrayContaining([{ module: 'entries', action: 'create' }]),
      after: [{ module: 'entries', action: 'view' }],
    })

    const invitation = await owner.post(`${home}/invitations`, {
      phoneE164: '+5511900005555',
      roleId,
    })
    const { invitationId, shareableLink } = (await invitation.json()) as {
      invitationId: string
      shareableLink: string
    }
    const [invited] = await auditOf('invitations', invitationId)
    expect(invited).toMatchObject({ action: 'create', actorUserId: ownerId })
    expect(invited?.after).not.toHaveProperty('tokenHash')

    const token = new URLSearchParams(new URL(shareableLink).hash.slice(1)).get('token')
    const joined = await app.request('/api/invitations/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
      body: JSON.stringify({
        token,
        displayName: 'Member New',
        password: 'a long enough password',
        email: `joined-${crypto.randomUUID()}-${fixtures.runId}@example.test`,
      }),
    })
    const { membershipId } = (await joined.json()) as { membershipId: string }
    const [membership] = await auditOf('memberships', membershipId)
    const joinedUserId = (membership?.after as { userId?: string } | undefined)?.userId
    expect(joinedUserId).toEqual(expect.any(String))
    expect(membership?.actorUserId).toBe(joinedUserId)
    expect((await auditOf('invitations', invitationId))[0]).toMatchObject({
      action: 'update',
      after: { acceptedAt: expect.any(String) },
    })

    await ok(owner.patch(`${home}/members/${membershipId}`, { roleId: await viewerRoleOf(home) }))
    expect((await auditOf('memberships', membershipId))[0]).toMatchObject({ action: 'update' })
    await ok(owner.del(`${home}/members/${membershipId}`, { reason: 'Saiu' }))
    expect((await auditOf('memberships', membershipId))[0]).toMatchObject({ action: 'delete' })
    await ok(owner.del(`${home}/roles/${roleId}`, {}))
    expect((await auditOf('roles', roleId))[0]).toMatchObject({ action: 'delete' })

    const revoked = (
      (await (
        await owner.post(`${home}/invitations`, {
          phoneE164: '+5511900006666',
          roleId: await viewerRoleOf(home),
        })
      ).json()) as { invitationId: string }
    ).invitationId
    await ok(owner.del(`${home}/invitations/${revoked}`))
    expect((await auditOf('invitations', revoked))[0]).toMatchObject({ action: 'delete' })

    await ok(owner.patch(`${home}/members/me/preferences`, { notifyBillsDaysBefore: 5 }))
    expect((await auditOf('membership_preferences', ownerId))[0]).toMatchObject({
      action: 'update',
      before: { notifyBillsDaysBefore: 3 },
      after: { notifyBillsDaysBefore: 5 },
    })
  })
})

async function viewerRoleOf(home: string): Promise<string> {
  const roles = (await (await owner.get(`${home}/roles`)).json()) as {
    roleId: string
    systemKey: string | null
  }[]
  return roles.find((role) => role.systemKey === 'viewer')?.roleId ?? ''
}
