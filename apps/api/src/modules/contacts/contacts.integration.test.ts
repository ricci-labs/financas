import { withWorkspace } from '@api/core/db/tx'
import { contacts } from '@api/modules/contacts/contacts.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let ownerUserId: string

beforeAll(async () => {
  ownerUserId = await fixtures.createUser('contacts-db')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function insertContact(
  workspaceId: string,
  values: { name?: string; phoneE164?: string | null } = {},
) {
  return withWorkspace(databases.app, workspaceId, (tx) =>
    tx.insert(contacts).values({ workspaceId, name: 'Contact J', ...values }),
  )
}

describe('contacts table', () => {
  it('refuses a malformed phone and a blank name', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Contact checks')
    for (const values of [{ phoneE164: '5511900001111' }, { name: ' ' }]) {
      expect(await postgresErrorCodeOf(insertContact(workspaceId, values))).toBe(
        POSTGRES_ERRORS.checkViolation,
      )
    }
  })

  it('keeps contacts inside their workspace', async () => {
    const mine = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Mine')).workspaceId
    const theirs = (await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Theirs')).workspaceId
    await insertContact(mine)
    const seen = await withWorkspace(databases.app, theirs, (tx) => tx.select().from(contacts))
    expect(seen).toEqual([])
    const intoMine = withWorkspace(databases.app, theirs, (tx) =>
      tx.insert(contacts).values({ workspaceId: mine, name: 'X' }),
    )
    expect(await postgresErrorCodeOf(intoMine)).toBe(POSTGRES_ERRORS.rowLevelSecurityViolation)
  })

  it('go away with the workspace when it is erased', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerUserId, 'Erase contacts')
    await insertContact(workspaceId, { phoneE164: '+5511900009999' })
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})
