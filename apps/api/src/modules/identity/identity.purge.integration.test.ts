import { generateToken, hashToken } from '@api/core/security/tokens'
import { purgeExpiredCredentials } from '@api/modules/identity'
import { authTokens, sessions } from '@api/modules/identity/identity.table'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const MS_PER_DAY = 24 * 60 * 60 * 1000

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY)
}

async function insertSession(userId: string, expiresInDays: number): Promise<string> {
  const [row] = await databases.app
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashToken(generateToken()),
      createdAt: daysFromNow(-40),
      expiresAt: daysFromNow(expiresInDays),
    })
    .returning({ id: sessions.id })
  return row?.id ?? ''
}

async function insertAuthToken(
  userId: string,
  expiresInDays: number,
  usedAt: Date | null = null,
): Promise<string> {
  const [row] = await databases.app
    .insert(authTokens)
    .values({
      userId,
      purpose: 'password_reset',
      tokenHash: hashToken(generateToken()),
      createdAt: daysFromNow(-40),
      expiresAt: daysFromNow(expiresInDays),
      usedAt,
    })
    .returning({ id: authTokens.id })
  return row?.id ?? ''
}

describe('purgeExpiredCredentials', () => {
  it('deletes expired sessions and expired links, used or not, and keeps the live ones', async () => {
    const userId = await fixtures.createUser('purge')
    const expiredSession = await insertSession(userId, -1)
    const liveSession = await insertSession(userId, 1)
    const expiredToken = await insertAuthToken(userId, -1)
    const usedExpiredToken = await insertAuthToken(userId, -1, daysFromNow(-2))
    const usedLiveToken = await insertAuthToken(userId, 1, daysFromNow(0))

    const purged = await purgeExpiredCredentials(databases.app)

    expect(purged.sessions).toBeGreaterThanOrEqual(1)
    expect(purged.authTokens).toBeGreaterThanOrEqual(2)
    const sessionsLeft = await databases.owner
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.id, [expiredSession, liveSession]))
    expect(sessionsLeft.map((row) => row.id)).toEqual([liveSession])
    const tokensLeft = await databases.owner
      .select({ id: authTokens.id })
      .from(authTokens)
      .where(inArray(authTokens.id, [expiredToken, usedExpiredToken, usedLiveToken]))
    expect(tokensLeft.map((row) => row.id)).toEqual([usedLiveToken])
  })
})
