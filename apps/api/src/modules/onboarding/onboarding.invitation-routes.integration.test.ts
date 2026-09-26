import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import { roles } from '@api/modules/access/access.table'
import type { PendingInvitation } from '@api/modules/members'
import { invitations } from '@api/modules/members/members.table'
import { testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole, loggedInUser, requestsAs } from '@api/testing/http'
import { createRecordingMailer } from '@api/testing/mailer'
import type { SessionRequests } from '@api/testing/testing.types'
import type { SystemRoleKey } from '@financas/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const recording = createRecordingMailer()
const background = createBackgroundTasks()
const app = createApp(testAppDeps({ db: databases.app, mailer: recording.mailer, background }))
const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000'

let owner: SessionRequests
let admin: SessionRequests
let member: SessionRequests
let viewer: SessionRequests
let workspaceId: string
let invitationsPath: string
let roleIds: Record<SystemRoleKey, string>
let foreignRoleId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'invites-owner')
  const adminSession = await loggedInUser(app, databases.app, fixtures.runId, 'invites-admin')
  const memberSession = await loggedInUser(app, databases.app, fixtures.runId, 'invites-member')
  const viewerSession = await loggedInUser(app, databases.app, fixtures.runId, 'invites-viewer')
  workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Invites')).workspaceId
  const foreign = await fixtures.createWorkspaceOwnedBy(memberSession.userId, 'Foreign')
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
  invitationsPath = `/api/workspaces/${workspaceId}/invitations`
  roleIds = await systemRoleIds(workspaceId)
  foreignRoleId = (await systemRoleIds(foreign.workspaceId)).member
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function systemRoleIds(ofWorkspace: string): Promise<Record<SystemRoleKey, string>> {
  const rows = await databases.owner
    .select({ id: roles.id, systemKey: roles.systemKey })
    .from(roles)
    .where(eq(roles.workspaceId, ofWorkspace))
  return Object.fromEntries(rows.map((row) => [row.systemKey, row.id])) as Record<
    SystemRoleKey,
    string
  >
}

function guestEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

async function invitationIdOf(response: Response): Promise<string> {
  return ((await response.json()) as { invitationId: string }).invitationId
}

describe('POST /invitations', () => {
  it('invites by email: answers with the link and emails it', async () => {
    const email = guestEmail('guest')
    const response = await admin.post(invitationsPath, { email, roleId: roleIds.member })
    expect(response.status).toBe(201)
    const issued = (await response.json()) as { invitationId: string; inviteLink: string }
    expect(issued.inviteLink).toMatch(/^http:\/\/localhost:5173\/invite#token=[\w-]{43}$/)

    await background.idle()
    const sent = recording.sent.find((message) => message.to === email)
    expect(sent).toMatchObject({ template: 'workspace_invitation' })
    expect(sent?.text).toContain(issued.inviteLink)
    expect(sent?.text).toContain(`Invites ${fixtures.runId}`)

    const pending = (await (await member.get(invitationsPath)).json()) as PendingInvitation[]
    expect(pending.map((invitation) => invitation.invitationId)).toContain(issued.invitationId)
  })

  it('invites by phone: answers with the link to share, and sends no email', async () => {
    const sentBefore = recording.sent.length
    const response = await admin.post(invitationsPath, {
      phoneE164: '+5511900001111',
      roleId: roleIds.viewer,
    })
    expect(response.status).toBe(201)
    await background.idle()
    expect(recording.sent).toHaveLength(sentBefore)
  })

  it('lets only an owner invite another owner', async () => {
    const asAdmin = await admin.post(invitationsPath, {
      email: guestEmail('owner-by-admin'),
      roleId: roleIds.owner,
    })
    expect([asAdmin.status, await codeOf(asAdmin)]).toEqual([403, 'OWNER_ONLY'])

    const asOwner = await owner.post(invitationsPath, {
      email: guestEmail('owner-by-owner'),
      roleId: roleIds.owner,
    })
    expect(asOwner.status).toBe(201)
  })

  it('refuses roles without members:create, foreign roles and invalid requests', async () => {
    const body = { email: guestEmail('refused'), roleId: roleIds.member }
    expect((await member.post(invitationsPath, body)).status).toBe(403)
    expect((await viewer.get(invitationsPath)).status).toBe(403)

    for (const roleId of [foreignRoleId, UNKNOWN_ID]) {
      const response = await admin.post(invitationsPath, { email: guestEmail('role'), roleId })
      expect([response.status, await codeOf(response)]).toEqual([400, 'ROLE_NOT_AVAILABLE'])
    }

    const invalid = await admin.post(invitationsPath, {
      phoneE164: '11999990000',
      roleId: roleIds.member,
    })
    expect([invalid.status, await codeOf(invalid)]).toEqual([400, 'INVITATION_INVALID'])
  })

  it('refuses a second pending invitation for the same contact, but not after it expired', async () => {
    const email = guestEmail('twice')
    const first = await invitationIdOf(
      await admin.post(invitationsPath, { email, roleId: roleIds.member }),
    )

    const duplicate = await admin.post(invitationsPath, {
      email: email.toUpperCase(),
      roleId: roleIds.member,
    })
    expect([duplicate.status, await codeOf(duplicate)]).toEqual([409, 'INVITATION_PENDING'])

    const lastWeek = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await databases.owner
      .update(invitations)
      .set({ createdAt: new Date(lastWeek.getTime() - 1000), expiresAt: lastWeek })
      .where(eq(invitations.id, first))

    const again = await admin.post(invitationsPath, { email, roleId: roleIds.member })
    expect(again.status).toBe(201)
    const [expired] = await databases.owner
      .select({ deleteReason: invitations.deleteReason })
      .from(invitations)
      .where(eq(invitations.id, first))
    expect(expired?.deleteReason).toBe('expired')
  })
})

describe('DELETE /invitations/:invitationId', () => {
  it('lets an owner revoke, once, and refuses roles without members:delete', async () => {
    const email = guestEmail('revoked')
    const invitationId = await invitationIdOf(
      await admin.post(invitationsPath, { email, roleId: roleIds.member }),
    )

    expect((await admin.del(`${invitationsPath}/${invitationId}`)).status).toBe(403)
    expect((await owner.del(`${invitationsPath}/${invitationId}`)).status).toBe(204)

    const again = await owner.del(`${invitationsPath}/${invitationId}`)
    expect([again.status, await codeOf(again)]).toEqual([409, 'INVITATION_REVOKED'])

    const pending = (await (await owner.get(invitationsPath)).json()) as PendingInvitation[]
    expect(pending.map((invitation) => invitation.invitationId)).not.toContain(invitationId)
    expect((await admin.post(invitationsPath, { email, roleId: roleIds.member })).status).toBe(201)
  })

  it('answers 404 for a malformed or unknown invitation', async () => {
    for (const invitationId of ['not-a-uuid', UNKNOWN_ID]) {
      const response = await owner.del(`${invitationsPath}/${invitationId}`)
      expect([response.status, await codeOf(response)]).toEqual([404, 'INVITATION_NOT_FOUND'])
    }
  })
})
