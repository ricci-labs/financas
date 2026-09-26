import { createApp } from '@api/app'
import { createBackgroundTasks } from '@api/core/background-tasks'
import { createLoginLimits } from '@api/modules/identity'
import { TEST_PUBLIC_URL, testAppDeps } from '@api/testing/app'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { loggedInUser, requestsAs } from '@api/testing/http'
import { createRecordingMailer } from '@api/testing/mailer'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const PASSWORD = 'a long enough password'
const NEW_PASSWORD = 'a brand new long password'
const SESSION_COOKIE = /^session=([\w-]{43});/

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function setup(maxFailuresPerEmail = 5) {
  const recording = createRecordingMailer()
  const background = createBackgroundTasks()
  const app = createApp(
    testAppDeps({
      db: databases.app,
      mailer: recording.mailer,
      background,
      loginLimits: createLoginLimits({
        maxFailuresPerEmail,
        maxFailuresPerClient: 50,
        windowMinutes: 15,
      }),
    }),
  )
  const login = async (email: string, password: string) => {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
      body: JSON.stringify({ email, password }),
    })
    const token = response.headers.get('Set-Cookie')?.match(SESSION_COOKIE)?.[1]
    return { status: response.status, cookie: `session=${token}` }
  }
  return { app, login, sent: recording.sent, background }
}

async function codeOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code
}

describe('POST /api/auth/password/change', () => {
  it('replaces the password, keeps this session, ends the others and tells the owner', async () => {
    const { app, login, sent, background } = setup()
    const session = await loggedInUser(app, databases.app, fixtures.runId, 'change-password')
    const otherDevice = await login(session.email, PASSWORD)
    const here = requestsAs(app, session)
    const there = requestsAs(app, { ...session, cookie: otherDevice.cookie })

    const response = await here.post('/api/auth/password/change', {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    })
    await background.idle()

    expect(response.status).toBe(204)
    expect((await here.get('/api/auth/me')).status).toBe(200)
    expect((await there.get('/api/auth/me')).status).toBe(401)
    expect((await login(session.email, PASSWORD)).status).toBe(401)
    expect((await login(session.email, NEW_PASSWORD)).status).toBe(200)
    expect(sent).toContainEqual(
      expect.objectContaining({ template: 'password_changed', to: session.email }),
    )
  })

  it('refuses a wrong current password, a weak new one and a caller without a session', async () => {
    const { app } = setup()
    const session = await loggedInUser(app, databases.app, fixtures.runId, 'change-refused')
    const requests = requestsAs(app, session)

    const wrong = await requests.post('/api/auth/password/change', {
      currentPassword: 'not the password',
      newPassword: NEW_PASSWORD,
    })
    expect([wrong.status, await codeOf(wrong)]).toEqual([400, 'CURRENT_PASSWORD_WRONG'])

    const weak = await requests.post('/api/auth/password/change', {
      currentPassword: PASSWORD,
      newPassword: 'short',
    })
    expect([weak.status, await codeOf(weak)]).toEqual([400, 'PASSWORD_INVALID'])

    const anonymous = await app.request('/api/auth/password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: TEST_PUBLIC_URL },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }),
    })
    expect(anonymous.status).toBe(401)
  })

  it('locks out a session that keeps guessing the current password', async () => {
    const { app } = setup(2)
    const session = await loggedInUser(app, databases.app, fixtures.runId, 'change-guessing')
    const requests = requestsAs(app, session)
    const guess = (currentPassword: string) =>
      requests.post('/api/auth/password/change', { currentPassword, newPassword: NEW_PASSWORD })

    expect((await guess('guess one')).status).toBe(400)
    expect((await guess('guess two')).status).toBe(400)
    const locked = await guess(PASSWORD)
    expect([locked.status, await codeOf(locked)]).toEqual([429, 'TOO_MANY_ATTEMPTS'])
  })
})

describe('PATCH /api/auth/me', () => {
  it('changes the display name', async () => {
    const { app } = setup()
    const requests = requestsAs(
      app,
      await loggedInUser(app, databases.app, fixtures.runId, 'rename-me'),
    )
    expect((await requests.patch('/api/auth/me', { displayName: ' Member Renamed ' })).status).toBe(
      204,
    )
    expect(await (await requests.get('/api/auth/me')).json()).toMatchObject({
      displayName: 'Member Renamed',
    })
    const empty = await requests.patch('/api/auth/me', { displayName: '  ' })
    expect([empty.status, await codeOf(empty)]).toEqual([400, 'PROFILE_INVALID'])
  })
})

describe('/api/auth/me/preferences', () => {
  it('starts from the defaults and stores language and quiet hours', async () => {
    const { app } = setup()
    const requests = requestsAs(
      app,
      await loggedInUser(app, databases.app, fixtures.runId, 'preferences'),
    )
    expect(await (await requests.get('/api/auth/me/preferences')).json()).toEqual({
      language: 'pt-BR',
      quietHoursStart: null,
      quietHoursEnd: null,
    })

    const changed = await requests.patch('/api/auth/me/preferences', {
      quietHoursStart: '22:00',
      quietHoursEnd: '07:30',
    })
    expect(await changed.json()).toEqual({
      language: 'pt-BR',
      quietHoursStart: '22:00',
      quietHoursEnd: '07:30',
    })

    const half = await requests.patch('/api/auth/me/preferences', { quietHoursStart: '23:00' })
    expect([half.status, await codeOf(half)]).toEqual([400, 'PREFERENCES_INVALID'])
  })
})
