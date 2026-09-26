import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import type { Mailer } from '@api/core/email/email.types'
import { createUser } from '@api/modules/identity'
import { users } from '@api/modules/identity/identity.table'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createCapturingLogger } from '@api/testing/logger'
import { createRecordingMailer } from '@api/testing/mailer'
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

function setup(options: { isPublicSignupEnabled?: boolean; mailer?: Mailer } = {}) {
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
    }),
  )
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
      body: JSON.stringify(body),
    })
  return { post, sent: recording.sent, background, entries: capture.entries }
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
