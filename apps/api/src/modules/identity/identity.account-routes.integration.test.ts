import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import type { Mailer } from '@api/core/email/email.types'
import {
  type AccountEmailLimits,
  createAccountEmailLimits,
  createUser,
} from '@api/modules/identity'
import { users } from '@api/modules/identity/identity.table'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createCapturingLogger } from '@api/testing/logger'
import { createRecordingMailer, tokenFromEmail } from '@api/testing/mailer'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const PASSWORD = 'a long enough password'
const FAST_COST = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function emailFor(label: string): string {
  return `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
}

type SetupOptions = {
  isPublicSignupEnabled?: boolean
  mailer?: Mailer
  accountEmailLimits?: AccountEmailLimits
}

function setup(options: SetupOptions = {}) {
  const recording = createRecordingMailer()
  const background = createBackgroundTasks()
  const capture = createCapturingLogger()
  const app = createApp(
    testAppDeps({
      db: databases.app,
      mailer: options.mailer ?? recording.mailer,
      isPublicSignupEnabled: options.isPublicSignupEnabled ?? true,
      background,
      logger: capture.logger,
      ...(options.accountEmailLimits ? { accountEmailLimits: options.accountEmailLimits } : {}),
    }),
  )
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
      body: JSON.stringify(body),
    })
  const login = (email: string, password: string) => post('/api/auth/login', { email, password })
  return { post, login, sent: recording.sent, background, entries: capture.entries }
}

async function existingUser(label: string) {
  const email = emailFor(label)
  await createUser(
    databases.app,
    { email, displayName: `Member ${label}`, password: PASSWORD, isEmailVerified: true },
    { passwordCost: FAST_COST },
  )
  return email
}

describe('POST /api/auth/signup', () => {
  it('is refused while public sign-up is off', async () => {
    const { post, sent, background } = setup({ isPublicSignupEnabled: false })
    const email = emailFor('route-signup-off')
    const response = await post('/api/auth/signup', {
      email,
      displayName: 'Member A',
      password: PASSWORD,
    })
    await background.idle()
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: { code: 'SIGNUP_DISABLED' } })
    expect(sent).toEqual([])
  })

  it('answers 202 at once and sends the verification email in the background', async () => {
    const { post, sent, background } = setup()
    const email = emailFor('route-signup')
    const response = await post('/api/auth/signup', {
      email,
      displayName: 'Member A',
      password: PASSWORD,
    })
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')

    await background.idle()
    expect(sent).toEqual([expect.objectContaining({ template: 'email_verification', to: email })])
  })

  it('gives the same answer for an email that already has an account', async () => {
    const { post, sent, background } = setup()
    const email = await existingUser('route-signup-taken')
    const response = await post('/api/auth/signup', {
      email,
      displayName: 'Intruder',
      password: 'another long password',
    })
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')
    await background.idle()
    expect(sent).toEqual([expect.objectContaining({ template: 'account_already_exists' })])
  })

  it('refuses a short password before accepting anything', async () => {
    const { post, sent, background } = setup()
    const email = emailFor('route-signup-short')
    const response = await post('/api/auth/signup', {
      email,
      displayName: 'Member A',
      password: 'too short',
    })
    await background.idle()
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'USER_INVALID' } })
    const [created] = await databases.owner.select().from(users).where(eq(users.email, email))
    expect(created).toBeUndefined()
    expect(sent).toEqual([])
  })
})

describe('POST /api/auth/password/forgot and /api/auth/verify-email/resend', () => {
  it('answer 202 whether the email exists or not, and email only a real account', async () => {
    const { post, sent, background } = setup()
    const email = await existingUser('route-forgot')

    const forExisting = await post('/api/auth/password/forgot', { email })
    const forUnknown = await post('/api/auth/password/forgot', { email: emailFor('nobody') })
    const resend = await post('/api/auth/verify-email/resend', { email: emailFor('nobody-2') })

    for (const response of [forExisting, forUnknown, resend]) {
      expect(response.status).toBe(202)
      expect(await response.text()).toBe('')
    }
    await background.idle()
    expect(sent).toEqual([expect.objectContaining({ template: 'password_reset', to: email })])
  })

  it('limit emails to one address to 3 per hour', async () => {
    const { post, background } = setup()
    const email = await existingUser('route-forgot-limit')
    const statuses = []
    for (let request = 0; request < 4; request += 1) {
      statuses.push((await post('/api/auth/password/forgot', { email })).status)
    }
    await background.idle()
    expect(statuses).toEqual([202, 202, 202, 429])
  })

  it('limit one client to 10 account emails per hour across addresses', async () => {
    const { post, background } = setup()
    const statuses = []
    for (let request = 0; request < 11; request += 1) {
      const response = await post('/api/auth/password/forgot', {
        email: emailFor(`spray-${request}`),
      })
      statuses.push(response.status)
    }
    await background.idle()
    expect(statuses.slice(0, 10).every((status) => status === 202)).toBe(true)
    expect(statuses[10]).toBe(429)
  })

  it('still answer 202 when sending fails, and log the failure', async () => {
    const failingMailer: Mailer = {
      send: async () => {
        throw new Error('smtp down')
      },
    }
    const { post, background, entries } = setup({ mailer: failingMailer })
    const email = await existingUser('route-forgot-smtp-down')

    const response = await post('/api/auth/password/forgot', { email })
    await background.idle()

    expect(response.status).toBe(202)
    expect(entries()).toContainEqual(
      expect.objectContaining({
        event: 'background.task.failed',
        task: 'auth.password_reset_requested',
      }),
    )
  })
})

describe('POST /api/auth/verify-email', () => {
  it('verifies with the emailed link once, then refuses it', async () => {
    const { post, login, sent, background } = setup()
    const email = emailFor('route-verify')
    await post('/api/auth/signup', { email, displayName: 'Member A', password: PASSWORD })
    await background.idle()
    const token = tokenFromEmail(sent[0])

    expect((await login(email, PASSWORD)).status).toBe(403)
    expect((await post('/api/auth/verify-email', { token })).status).toBe(204)
    expect((await login(email, PASSWORD)).status).toBe(200)

    const again = await post('/api/auth/verify-email', { token })
    expect(again.status).toBe(400)
    expect(await again.json()).toMatchObject({ error: { code: 'LINK_INVALID' } })
  })
})

describe('POST /api/auth/password/reset', () => {
  async function resetLink(label: string) {
    const context = setup()
    const email = await existingUser(label)
    await context.post('/api/auth/password/forgot', { email })
    await context.background.idle()
    return { ...context, email, token: tokenFromEmail(context.sent[0]) }
  }

  it('sets the new password, clears the cookie and tells the owner', async () => {
    const { post, login, sent, background, email, token } = await resetLink('route-reset')
    const response = await post('/api/auth/password/reset', {
      token,
      password: 'the new long password',
    })
    await background.idle()

    expect(response.status).toBe(204)
    expect(response.headers.get('Set-Cookie')).toMatch(/^session=;.*Max-Age=0/)
    expect((await login(email, PASSWORD)).status).toBe(401)
    expect((await login(email, 'the new long password')).status).toBe(200)
    expect(sent.map((message) => message.template)).toEqual(['password_reset', 'password_changed'])
  })

  it('refuses a short password and keeps the link usable', async () => {
    const { post, token } = await resetLink('route-reset-short')
    const short = await post('/api/auth/password/reset', { token, password: 'too short' })
    expect(short.status).toBe(400)
    expect(await short.json()).toMatchObject({ error: { code: 'PASSWORD_INVALID' } })
    const good = await post('/api/auth/password/reset', {
      token,
      password: 'the new long password',
    })
    expect(good.status).toBe(204)
  })
})

describe('invalid links', () => {
  it('lock a client out after too many, even with a valid link', async () => {
    const context = setup({
      accountEmailLimits: createAccountEmailLimits({
        maxPerEmailPerHour: 3,
        maxPerClientPerHour: 10,
        maxInvalidLinksPerClientPerHour: 2,
      }),
    })
    const email = await existingUser('route-link-limit')
    await context.post('/api/auth/password/forgot', { email })
    await context.background.idle()
    const token = tokenFromEmail(context.sent[0])

    const statuses = []
    for (const guess of ['guess-1', 'guess-2']) {
      statuses.push((await context.post('/api/auth/verify-email', { token: guess })).status)
    }
    const locked = await context.post('/api/auth/password/reset', {
      token,
      password: 'the new long password',
    })

    expect(statuses).toEqual([400, 400])
    expect(locked.status).toBe(429)
    expect(Number(locked.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect((await context.login(email, PASSWORD)).status).toBe(200)
  })
})
