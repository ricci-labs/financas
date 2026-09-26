import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import type { WorkspaceListItem } from '@api/modules/access'
import { roles } from '@api/modules/access/access.table'
import { createAccountEmailLimits } from '@api/modules/identity'
import { users } from '@api/modules/identity/identity.table'
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
      maxInvalidLinksPerClientPerHour: 50,
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

async function phoneInvitationToken(phoneE164: string): Promise<string> {
  const response = await owner.post(`/api/workspaces/${workspaceId}/invitations`, {
    phoneE164,
    roleId: memberRoleId,
  })
  const { shareableLink } = (await response.json()) as { shareableLink: string }
  return new URLSearchParams(new URL(shareableLink).hash.slice(1)).get('token') ?? ''
}

function newEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
}

function login(email: string, password: string) {
  return publicPost('/api/auth/login', { email, password })
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

describe('POST /api/invitations/sign-up', () => {
  const PASSWORD = 'a long enough password'

  it('creates a verified account with the invited email, even with public sign-up off', async () => {
    const invitedEmail = newEmail('new-by-email')
    const token = await emailInvitationTo(invitedEmail)

    const response = await publicPost('/api/invitations/sign-up', {
      token,
      displayName: 'Member New',
      password: PASSWORD,
      email: newEmail('ignored'),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ workspaceId, isEmailVerified: true })
    const [account] = await databases.owner
      .select()
      .from(users)
      .where(eq(users.email, invitedEmail))
    expect(account?.emailVerifiedAt).not.toBeNull()
    expect((await login(invitedEmail, PASSWORD)).status).toBe(200)
  })

  it('asks a phone invitee for an email, and makes them verify it before logging in', async () => {
    const email = newEmail('new-by-phone')
    const token = await phoneInvitationToken('+5511900004444')

    const withoutEmail = await publicPost('/api/invitations/sign-up', {
      token,
      displayName: 'Member Phone',
      password: PASSWORD,
    })
    expect([withoutEmail.status, await codeOf(withoutEmail)]).toEqual([400, 'EMAIL_REQUIRED'])

    const response = await publicPost('/api/invitations/sign-up', {
      token,
      displayName: 'Member Phone',
      password: PASSWORD,
      email,
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ workspaceId, isEmailVerified: false })

    const beforeVerifying = await login(email, PASSWORD)
    expect([beforeVerifying.status, await codeOf(beforeVerifying)]).toEqual([
      403,
      'EMAIL_NOT_VERIFIED',
    ])

    const verification = [...recording.sent].reverse().find((sent) => sent.to === email)
    expect(verification).toMatchObject({ template: 'email_verification' })
    await publicPost('/api/auth/verify-email', { token: tokenFromEmail(verification) })
    expect((await login(email, PASSWORD)).status).toBe(200)
  })

  it('sends an existing account to log in and accept instead', async () => {
    const invitee = await guest('existing-account')
    const token = await emailInvitationTo(invitee.email)
    const response = await publicPost('/api/invitations/sign-up', {
      token,
      displayName: 'Someone',
      password: PASSWORD,
    })
    expect([response.status, await codeOf(response)]).toEqual([409, 'EMAIL_TAKEN'])
  })

  it('refuses a weak password and a made-up token', async () => {
    const token = await emailInvitationTo(newEmail('weak'))
    const weak = await publicPost('/api/invitations/sign-up', {
      token,
      displayName: 'Weak',
      password: 'short',
    })
    expect([weak.status, await codeOf(weak)]).toEqual([400, 'INVITATION_SIGN_UP_INVALID'])

    const madeUp = await publicPost('/api/invitations/sign-up', {
      token: 'made-up-token',
      displayName: 'Nobody',
      password: PASSWORD,
    })
    expect([madeUp.status, await codeOf(madeUp)]).toEqual([404, 'INVITATION_NOT_FOUND'])
  })
})

describe('invalid invitation links', () => {
  it('answer 404, and lock a client out after too many', async () => {
    const limitedApp = createApp(
      testAppDeps({
        db: databases.app,
        accountEmailLimits: createAccountEmailLimits({
          maxPerEmailPerHour: 50,
          maxPerClientPerHour: 50,
          maxInvalidLinksPerClientPerHour: 3,
        }),
      }),
    )
    const statuses = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await limitedApp.request('/api/invitations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
        body: JSON.stringify({ token: `made-up-${attempt}` }),
      })
      statuses.push(response.status)
    }
    expect(statuses).toEqual([404, 404, 404, 429])
  })
})
