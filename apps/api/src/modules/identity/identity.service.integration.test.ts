import type { Clock } from '@api/core/clock.types'
import type { PasswordCost } from '@api/core/security/security.types'
import { hashToken } from '@api/core/security/tokens'
import {
  createUser,
  type IdentityDeps,
  login,
  logout,
  type NewUserInput,
  resolveSession,
} from '@api/modules/identity'
import { sessions, users } from '@api/modules/identity/identity.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

const PASSWORD = 'a long enough password'
const FAST_COST: PasswordCost = { cpuMemoryCost: 2 ** 10, blockSize: 8, parallelization: 1 }
const HIGHER_FAST_COST: PasswordCost = { ...FAST_COST, cpuMemoryCost: 2 ** 11 }
const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR
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

function depsAt(date: Date): Partial<IdentityDeps> {
  return { clock: clockAt(date), passwordCost: FAST_COST }
}

function emailFor(label: string): string {
  return `${label}-${crypto.randomUUID()}-${fixtures.runId}@example.test`
}

async function newUser(label: string, overrides: Partial<NewUserInput> = {}) {
  const input = {
    email: emailFor(label),
    displayName: `Member ${label}`,
    password: PASSWORD,
    isEmailVerified: true,
    ...overrides,
  }
  const userId = await createUser(databases.app, input, depsAt(START))
  return { userId, email: input.email }
}

async function storedUser(userId: string) {
  const [user] = await databases.owner.select().from(users).where(eq(users.id, userId))
  return user
}

async function sessionRows(userId: string) {
  return databases.owner.select().from(sessions).where(eq(sessions.userId, userId))
}

describe('createUser', () => {
  it('stores a normalized email and a scrypt hash, never the password', async () => {
    const email = emailFor('create')
    const userId = await createUser(
      databases.app,
      {
        email: `  ${email.toUpperCase()} `,
        displayName: ' Member A ',
        password: PASSWORD,
        isEmailVerified: false,
      },
      depsAt(START),
    )
    const user = await storedUser(userId)
    expect(user).toMatchObject({ email, displayName: 'Member A', emailVerifiedAt: null })
    expect(user?.passwordHash).toMatch(/^scrypt\$1024\$8\$1\$/)
    expect(user?.passwordHash).not.toContain(PASSWORD)
  })

  it('marks the email verified when asked, at the clock time', async () => {
    const { userId } = await newUser('verified')
    expect((await storedUser(userId))?.emailVerifiedAt).toEqual(START)
  })

  it('refuses an email that is taken, whatever its case', async () => {
    const { email } = await newUser('taken')
    await expect(newUser('taken-again', { email: email.toUpperCase() })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    })
  })

  it('refuses a password shorter than 12 characters', async () => {
    await expect(newUser('short', { password: 'too short' })).rejects.toMatchObject({
      code: 'USER_INVALID',
    })
  })
})

describe('login', () => {
  it('starts a 30-day session and stores only the hash of its token', async () => {
    const { userId, email } = await newUser('login')
    const session = await login(
      databases.app,
      { email, password: PASSWORD, userAgent: 'Test Browser' },
      depsAt(START),
    )

    expect(session).toMatchObject({ userId, expiresAt: later(30 * MS_PER_DAY) })
    expect(session.token).toMatch(/^[\w-]{43}$/)
    const [row] = await sessionRows(userId)
    expect(row).toMatchObject({
      tokenHash: hashToken(session.token),
      userAgent: 'Test Browser',
      createdAt: START,
      lastSeenAt: START,
    })
  })

  it('accepts the email in any case and with spaces around it', async () => {
    const { email } = await newUser('case')
    const session = await login(
      databases.app,
      { email: ` ${email.toUpperCase()} `, password: PASSWORD },
      depsAt(START),
    )
    expect(session.token).toBeTruthy()
  })

  it('gives the same answer for a wrong password, an unknown email and a disabled user', async () => {
    const { email } = await newUser('wrong')
    const disabled = await newUser('disabled')
    await databases.owner
      .update(users)
      .set({ disabledAt: START })
      .where(eq(users.id, disabled.userId))

    const attempts = [
      { email, password: 'not the password' },
      { email: emailFor('nobody'), password: PASSWORD },
      { email: disabled.email, password: PASSWORD },
      { email: 'not-an-email', password: PASSWORD },
    ]
    for (const attempt of attempts) {
      await expect(login(databases.app, attempt, depsAt(START))).rejects.toMatchObject({
        name: 'UnauthorizedError',
        code: 'INVALID_CREDENTIALS',
      })
    }
    expect(await sessionRows(disabled.userId)).toEqual([])
  })

  it('refuses an unverified email only after a correct password', async () => {
    const { email } = await newUser('unverified', { isEmailVerified: false })
    await expect(
      login(databases.app, { email, password: 'not the password' }, depsAt(START)),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(
      login(databases.app, { email, password: PASSWORD }, depsAt(START)),
    ).rejects.toMatchObject({ name: 'ForbiddenError', code: 'EMAIL_NOT_VERIFIED' })
  })

  it('stores a new hash when the current cost is higher than the stored one', async () => {
    const { userId, email } = await newUser('rehash')
    await login(
      databases.app,
      { email, password: PASSWORD },
      { clock: clockAt(START), passwordCost: HIGHER_FAST_COST },
    )
    const rehashed = (await storedUser(userId))?.passwordHash
    expect(rehashed).toMatch(/^scrypt\$2048\$8\$1\$/)
    await expect(
      login(databases.app, { email, password: PASSWORD }, depsAt(START)),
    ).resolves.toMatchObject({ userId })
  })

  it('cuts a very long user agent', async () => {
    const { userId, email } = await newUser('agent')
    await login(
      databases.app,
      { email, password: PASSWORD, userAgent: 'x'.repeat(2000) },
      depsAt(START),
    )
    const [row] = await sessionRows(userId)
    expect(row?.userAgent).toHaveLength(512)
  })
})

describe('resolveSession', () => {
  async function loggedIn(label: string) {
    const { userId, email } = await newUser(label)
    const session = await login(databases.app, { email, password: PASSWORD }, depsAt(START))
    return { userId, token: session.token }
  }

  it('finds the user of a token without writing within the first hour', async () => {
    const { userId, token } = await loggedIn('resolve')
    const active = await resolveSession(databases.app, token, depsAt(later(30 * 60 * 1000)))
    expect(active).toMatchObject({ userId, expiresAt: later(30 * MS_PER_DAY), isRenewed: false })
    const [row] = await sessionRows(userId)
    expect(row?.lastSeenAt).toEqual(START)
  })

  it('renews the expiry after an hour of use', async () => {
    const { userId, token } = await loggedIn('renew')
    const twoHoursLater = later(2 * MS_PER_HOUR)
    const active = await resolveSession(databases.app, token, depsAt(twoHoursLater))
    const renewedExpiry = new Date(twoHoursLater.getTime() + 30 * MS_PER_DAY)
    expect(active).toMatchObject({ userId, expiresAt: renewedExpiry, isRenewed: true })
    const [row] = await sessionRows(userId)
    expect(row).toMatchObject({ lastSeenAt: twoHoursLater, expiresAt: renewedExpiry })
  })

  it('ends a session unused for 30 days and deletes it', async () => {
    const { userId, token } = await loggedIn('expired')
    expect(await resolveSession(databases.app, token, depsAt(later(30 * MS_PER_DAY)))).toBeNull()
    expect(await sessionRows(userId)).toEqual([])
  })

  it('ends the sessions of a disabled user', async () => {
    const { userId, token } = await loggedIn('disabled-later')
    await databases.owner.update(users).set({ disabledAt: START }).where(eq(users.id, userId))
    expect(await resolveSession(databases.app, token, depsAt(START))).toBeNull()
    expect(await sessionRows(userId)).toEqual([])
  })

  it('knows nothing about an unknown token', async () => {
    expect(await resolveSession(databases.app, 'not-a-token', depsAt(START))).toBeNull()
  })
})

describe('logout', () => {
  it('deletes the session, and doing it twice is harmless', async () => {
    const { userId, email } = await newUser('logout')
    const { token } = await login(databases.app, { email, password: PASSWORD }, depsAt(START))
    await logout(databases.app, token)
    await logout(databases.app, token)
    expect(await sessionRows(userId)).toEqual([])
    expect(await resolveSession(databases.app, token, depsAt(START))).toBeNull()
  })
})
