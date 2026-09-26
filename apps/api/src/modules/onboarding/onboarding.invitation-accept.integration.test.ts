import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import type { WorkspaceListItem } from '@api/modules/access'
import { roles } from '@api/modules/access/access.table'
import { createAccountEmailLimits } from '@api/modules/identity'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { loggedInUser, requestsAs } from '@api/testing/http'
import { createRecordingMailer, tokenFromEmail } from '@api/testing/mailer'
import type { SessionRequests, TestSession } from '@api/testing/testing.types'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const recording = createRecordingMailer()
const background = createBackgroundTasks()
const app = createApp(
  testAppDeps({
    db: databases.app,
    mailer: recording.mailer,
    background,
    accountEmailLimits: createAccountEmailLimits({
      maxPerEmailPerHour: 50,
      maxPerClientPerHour: 50,
      maxInvalidLinksPerClientPerHour: 3,
    }),
  }),
)

let owner: SessionRequests
let workspaceId: string
let memberRoleId: string

beforeAll(async () => {
  const ownerSession = await loggedInUser(app, databases.app, fixtures.runId, 'accept-owner')
  workspaceId = (await fixtures.createWorkspaceOwnedBy(ownerSession.userId, 'Casa')).workspaceId
  owner = requestsAs(app, ownerSession)
  const [role] = await databases.owner
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.workspaceId, workspaceId), eq(roles.systemKey, 'member')))
  memberRoleId = role?.id ?? ''
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function emailInvitationTo(email: string): Promise<string> {
  await owner.post(`/api/workspaces/${workspaceId}/invitations`, { email, roleId: memberRoleId })
  await background.idle()
  const message = [...recording.sent].reverse().find((sent) => sent.to === email)
  return tokenFromEmail(message)
}

function publicPost(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
    body: JSON.stringify(body),
  })
}

async function guest(label: string): Promise<TestSession> {
  return loggedInUser(app, databases.app, fixtures.runId, label)
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('POST /api/invitations/preview', () => {
  it('shows the invitation to whoever holds the link, without a session', async () => {
    const invitee = await guest('preview-guest')
    const token = await emailInvitationTo(invitee.email)

    const response = await publicPost('/api/invitations/preview', { token })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      workspaceName: `Casa ${fixtures.runId}`,
      inviterName: 'Member accept-owner',
      roleName: 'Membro',
      email: invitee.email,
      isPhoneInvitation: false,
    })
  })
})

describe('POST /api/invitations/accept', () => {
  it('lets the invited user join, and only once', async () => {
    const invitee = await guest('accept-guest')
    const token = await emailInvitationTo(invitee.email)
    const asInvitee = requestsAs(app, invitee)

    const accepted = await asInvitee.post('/api/invitations/accept', { token })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ workspaceId })

    const workspaces = (await (
      await asInvitee.get('/api/workspaces')
    ).json()) as WorkspaceListItem[]
    expect(workspaces).toContainEqual(
      expect.objectContaining({
        workspaceId,
        role: expect.objectContaining({ systemKey: 'member' }),
      }),
    )

    const again = await asInvitee.post('/api/invitations/accept', { token })
    expect([again.status, await codeOf(again)]).toEqual([409, 'INVITATION_ALREADY_ACCEPTED'])
  })

  it('refuses a user logged in with another email, and leaves the invitation open', async () => {
    const invitee = await guest('meant-guest')
    const intruder = await guest('intruder')
    const token = await emailInvitationTo(invitee.email)

    const refused = await requestsAs(app, intruder).post('/api/invitations/accept', { token })
    expect([refused.status, await codeOf(refused)]).toEqual([403, 'INVITATION_FOR_ANOTHER_EMAIL'])

    const accepted = await requestsAs(app, invitee).post('/api/invitations/accept', { token })
    expect(accepted.status).toBe(200)
  })

  it('lets anyone holding the link accept a phone invitation', async () => {
    const response = await owner.post(`/api/workspaces/${workspaceId}/invitations`, {
      phoneE164: '+5511900003333',
      roleId: memberRoleId,
    })
    const { shareableLink } = (await response.json()) as { shareableLink: string }
    const token = new URLSearchParams(new URL(shareableLink).hash.slice(1)).get('token')

    const accepted = await requestsAs(app, await guest('phone-guest')).post(
      '/api/invitations/accept',
      { token },
    )
    expect(accepted.status).toBe(200)
  })

  it('asks for a session', async () => {
    const response = await publicPost('/api/invitations/accept', { token: 'x'.repeat(43) })
    expect(response.status).toBe(401)
  })
})

describe('invalid invitation links', () => {
  it('answer 404, and lock a client out after too many', async () => {
    const statuses = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await publicPost('/api/invitations/preview', { token: `made-up-${attempt}` })
      statuses.push(response.status)
    }
    expect(statuses).toEqual([404, 404, 404, 429])
  })
})
