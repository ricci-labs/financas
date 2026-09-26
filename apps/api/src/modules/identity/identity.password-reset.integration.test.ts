import type { Clock } from '@api/core/clock'
import type { PasswordCost } from '@api/core/security/passwords'
import { hashToken } from '@api/core/security/tokens'
import {
  type AccountEmailDeps,
  createUser,
  login,
  requestPasswordReset,
  resetPassword,
  resolveSession,
} from '@api/modules/identity'
import { authTokens, users } from '@api/modules/identity/identity.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { createRecordingMailer, tokenFromEmail } from '@api/testing/mailer'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const OLD_PASSWORD = 'the old long password'
const NEW_PASSWORD = 'the new long password'
const FAST_COST: PasswordCost = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const PUBLIC_URL = 'https://financas.example.test'
const MS_PER_MINUTE = 60 * 1000
const START = new Date('2026-10-01T12:00:00Z')

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function clockAt(date: Date): Clock {
  return { now: () => date }
}

function later(milliseconds: number): Date {
  return new Date(START.getTime() + milliseconds)
}

function setup(date = START) {
  const { mailer, sent } = createRecordingMailer()
  const deps: AccountEmailDeps = {
    mailer,
    publicUrl: PUBLIC_URL,
    clock: clockAt(date),
    passwordCost: FAST_COST,
  }
  return { deps, sent }
}

async function existingUser(label: string, isEmailVerified = true) {
  const email = `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
  const userId = await createUser(
    databases.app,
    { email, displayName: `Member ${label}`, password: OLD_PASSWORD, isEmailVerified },
    { passwordCost: FAST_COST },
  )
  return { userId, email }
}

function loginWith(email: string, password: string) {
  return login(
    databases.app,
    { email, password },
    { clock: clockAt(START), passwordCost: FAST_COST },
  )
}

async function resetLinkFor(email: string) {
  const { deps, sent } = setup()
  await requestPasswordReset(databases.app, { email }, deps)
  return tokenFromEmail(sent[0])
}

describe('requestPasswordReset', () => {
  it('emails a one-hour, single-use link kept only as a hash', async () => {
    const { userId, email } = await existingUser('request')
    const { deps, sent } = setup()

    await requestPasswordReset(databases.app, { email: email.toUpperCase() }, deps)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ template: 'password_reset', to: email })
    expect(sent[0]?.text).toContain(`${PUBLIC_URL}/reset-password#token=`)
    const [stored] = await databases.owner
      .select()
      .from(authTokens)
      .where(eq(authTokens.userId, userId))
    expect(stored).toMatchObject({
      purpose: 'password_reset',
      tokenHash: hashToken(tokenFromEmail(sent[0])),
      expiresAt: later(60 * MS_PER_MINUTE),
    })
  })

  it('sends nothing for an unknown email, a malformed one or a disabled user', async () => {
    const disabled = await existingUser('disabled')
    await databases.owner
      .update(users)
      .set({ disabledAt: START })
      .where(eq(users.id, disabled.userId))
    const { deps, sent } = setup()

    const unknownEmail = `nobody-${fixtures.runId}@example.test`
    for (const email of [unknownEmail, 'not-an-email', disabled.email]) {
      await expect(requestPasswordReset(databases.app, { email }, deps)).resolves.toBeUndefined()
    }
    expect(sent).toEqual([])
  })

  it('retires the previous link when a new one is asked for', async () => {
    const { email } = await existingUser('twice')
    const firstToken = await resetLinkFor(email)
    const secondToken = await resetLinkFor(email)

    const { deps } = setup()
    await expect(
      resetPassword(databases.app, { token: firstToken, password: NEW_PASSWORD }, deps),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await resetPassword(databases.app, { token: secondToken, password: NEW_PASSWORD }, deps)
  })
})

describe('resetPassword', () => {
  it('replaces the password, ends every session and tells the owner', async () => {
    const { userId, email } = await existingUser('reset')
    const openSession = await loginWith(email, OLD_PASSWORD)
    const token = await resetLinkFor(email)
    const { deps, sent } = setup()

    await resetPassword(databases.app, { token, password: NEW_PASSWORD }, deps)

    await expect(loginWith(email, OLD_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    await expect(loginWith(email, NEW_PASSWORD)).resolves.toMatchObject({ userId })
    expect(
      await resolveSession(databases.app, openSession.token, { clock: clockAt(START) }),
    ).toBeNull()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ template: 'password_changed', to: email })
  })

  it('verifies the email, since the link proved the user can read it', async () => {
    const { userId, email } = await existingUser('unverified-reset', false)
    const token = await resetLinkFor(email)
    await resetPassword(databases.app, { token, password: NEW_PASSWORD }, setup().deps)
    const [user] = await databases.owner.select().from(users).where(eq(users.id, userId))
    expect(user?.emailVerifiedAt).toEqual(START)
  })

  it('checks the link before hashing the new password', async () => {
    const hashingWouldFail = { cpuMemoryCost: 3, blockSize: 8, parallelization: 1 }
    const { deps } = setup()
    await expect(
      resetPassword(
        databases.app,
        { token: 'made-up-token', password: NEW_PASSWORD },
        { ...deps, passwordCost: hashingWouldFail },
      ),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
  })

  it('works only once', async () => {
    const { email } = await existingUser('once')
    const token = await resetLinkFor(email)
    const { deps } = setup()
    await resetPassword(databases.app, { token, password: NEW_PASSWORD }, deps)
    await expect(
      resetPassword(databases.app, { token, password: 'a third long password' }, deps),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await expect(loginWith(email, NEW_PASSWORD)).resolves.toHaveProperty('token')
  })

  it('refuses a link older than one hour and keeps the old password', async () => {
    const { email } = await existingUser('late')
    const token = await resetLinkFor(email)
    const { deps } = setup(later(60 * MS_PER_MINUTE))
    await expect(
      resetPassword(databases.app, { token, password: NEW_PASSWORD }, deps),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await expect(loginWith(email, OLD_PASSWORD)).resolves.toHaveProperty('token')
  })

  it('refuses a short password without spending the link', async () => {
    const { email } = await existingUser('short')
    const token = await resetLinkFor(email)
    const { deps } = setup()
    await expect(
      resetPassword(databases.app, { token, password: 'too short' }, deps),
    ).rejects.toMatchObject({ code: 'PASSWORD_INVALID' })
    await resetPassword(databases.app, { token, password: NEW_PASSWORD }, deps)
  })

  it('refuses an email verification link', async () => {
    const { userId, email } = await existingUser('other-purpose', false)
    const verificationToken = 'email-verification-token-for-this-test'
    await databases.owner.insert(authTokens).values({
      userId,
      purpose: 'email_verification',
      tokenHash: hashToken(verificationToken),
      createdAt: START,
      expiresAt: later(60 * MS_PER_MINUTE),
    })
    await expect(
      resetPassword(
        databases.app,
        { token: verificationToken, password: NEW_PASSWORD },
        setup().deps,
      ),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })
    await expect(loginWith(email, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('refuses a link of a user disabled after asking for it', async () => {
    const { userId, email } = await existingUser('disabled-later')
    const token = await resetLinkFor(email)
    const [before] = await databases.owner.select().from(users).where(eq(users.id, userId))
    await databases.owner.update(users).set({ disabledAt: START }).where(eq(users.id, userId))

    await expect(
      resetPassword(databases.app, { token, password: NEW_PASSWORD }, setup().deps),
    ).rejects.toMatchObject({ code: 'LINK_INVALID' })

    const [after] = await databases.owner.select().from(users).where(eq(users.id, userId))
    expect(after?.passwordHash).toBe(before?.passwordHash)
  })
})
