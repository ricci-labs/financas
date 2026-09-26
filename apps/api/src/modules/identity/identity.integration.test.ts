import { generateToken, hashToken } from '@api/core/security/tokens'
import { authTokens, sessions, userPreferences, users } from '@api/modules/identity/identity.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

describe('user preferences', () => {
  it('default to Portuguese with no quiet hours', async () => {
    const userId = await fixtures.createUser('defaults')
    const [preferences] = await databases.app.insert(userPreferences).values({ userId }).returning()
    expect(preferences).toMatchObject({
      language: 'pt-BR',
      quietHoursStart: null,
      quietHoursEnd: null,
    })
  })

  it('accept quiet hours set as a pair', async () => {
    const userId = await fixtures.createUser('quiet')
    const nightOnly = databases.app
      .insert(userPreferences)
      .values({ userId, quietHoursStart: '22:00', quietHoursEnd: '07:00' })
    expect(await postgresErrorCodeOf(nightOnly)).toBeUndefined()
  })

  it('reject quiet hours with only one side', async () => {
    const userId = await fixtures.createUser('half-quiet')
    const onlyStart = databases.app
      .insert(userPreferences)
      .values({ userId, quietHoursStart: '22:00' })
    expect(await postgresErrorCodeOf(onlyStart)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('reject a malformed language tag', async () => {
    const userId = await fixtures.createUser('language')
    const badLanguage = databases.app.insert(userPreferences).values({ userId, language: 'PT_br' })
    expect(await postgresErrorCodeOf(badLanguage)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('are removed with their user', async () => {
    const userId = await fixtures.createUser('leaving')
    await databases.app.insert(userPreferences).values({ userId })
    await databases.owner.delete(users).where(eq(users.id, userId))
    const leftovers = await databases.app
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
    expect(leftovers).toEqual([])
  })
})

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * ONE_DAY_MS)
}

describe('sessions', () => {
  it('are created by the app role with a hashed token', async () => {
    const userId = await fixtures.createUser('session')
    const [session] = await databases.app
      .insert(sessions)
      .values({ userId, tokenHash: hashToken(generateToken()), expiresAt: daysFromNow(30) })
      .returning()
    expect(session).toMatchObject({ userId, userAgent: null })
  })

  it('reject a token hash that is already in use', async () => {
    const userId = await fixtures.createUser('session-twice')
    const tokenHash = hashToken(generateToken())
    await databases.app.insert(sessions).values({ userId, tokenHash, expiresAt: daysFromNow(30) })
    const sameToken = databases.app
      .insert(sessions)
      .values({ userId, tokenHash, expiresAt: daysFromNow(30) })
    expect(await postgresErrorCodeOf(sameToken)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })

  it('reject an expiry before the creation', async () => {
    const userId = await fixtures.createUser('session-expired')
    const alreadyExpired = databases.app
      .insert(sessions)
      .values({ userId, tokenHash: hashToken(generateToken()), expiresAt: daysFromNow(-1) })
    expect(await postgresErrorCodeOf(alreadyExpired)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('are removed with their user', async () => {
    const userId = await fixtures.createUser('session-leaving')
    await databases.app
      .insert(sessions)
      .values({ userId, tokenHash: hashToken(generateToken()), expiresAt: daysFromNow(30) })
    await databases.owner.delete(users).where(eq(users.id, userId))
    const leftovers = await databases.app.select().from(sessions).where(eq(sessions.userId, userId))
    expect(leftovers).toEqual([])
  })
})

describe('auth tokens', () => {
  it('are created by the app role for each purpose', async () => {
    const userId = await fixtures.createUser('auth-token')
    const created = await databases.app
      .insert(authTokens)
      .values([
        {
          userId,
          purpose: 'email_verification',
          tokenHash: hashToken(generateToken()),
          expiresAt: daysFromNow(1),
        },
        {
          userId,
          purpose: 'password_reset',
          tokenHash: hashToken(generateToken()),
          expiresAt: daysFromNow(1),
        },
      ])
      .returning({ purpose: authTokens.purpose, usedAt: authTokens.usedAt })
    expect(created).toEqual([
      { purpose: 'email_verification', usedAt: null },
      { purpose: 'password_reset', usedAt: null },
    ])
  })

  it('reject a token hash that is already in use', async () => {
    const userId = await fixtures.createUser('auth-token-twice')
    const tokenHash = hashToken(generateToken())
    const token = {
      userId,
      purpose: 'password_reset' as const,
      tokenHash,
      expiresAt: daysFromNow(1),
    }
    await databases.app.insert(authTokens).values(token)
    const sameToken = databases.app.insert(authTokens).values(token)
    expect(await postgresErrorCodeOf(sameToken)).toBe(POSTGRES_ERRORS.uniqueViolation)
  })

  it('reject an expiry before the creation', async () => {
    const userId = await fixtures.createUser('auth-token-expired')
    const alreadyExpired = databases.app.insert(authTokens).values({
      userId,
      purpose: 'password_reset',
      tokenHash: hashToken(generateToken()),
      expiresAt: daysFromNow(-1),
    })
    expect(await postgresErrorCodeOf(alreadyExpired)).toBe(POSTGRES_ERRORS.checkViolation)
  })

  it('are removed with their user', async () => {
    const userId = await fixtures.createUser('auth-token-leaving')
    await databases.app.insert(authTokens).values({
      userId,
      purpose: 'email_verification',
      tokenHash: hashToken(generateToken()),
      expiresAt: daysFromNow(1),
    })
    await databases.owner.delete(users).where(eq(users.id, userId))
    const leftovers = await databases.app
      .select()
      .from(authTokens)
      .where(eq(authTokens.userId, userId))
    expect(leftovers).toEqual([])
  })
})
