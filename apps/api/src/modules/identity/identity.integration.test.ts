import { userPreferences, users } from '@api/modules/identity/identity.table'
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
