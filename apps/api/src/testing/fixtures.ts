import type { Database } from '@api/core/db/client'
import { users } from '@api/modules/identity/identity.table'
import { createWorkspace } from '@api/modules/onboarding'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { inArray, like } from 'drizzle-orm'

export function createFixtures(ownerDb: Database, appDb: Database) {
  const runId = crypto.randomUUID()
  const runEmails = like(users.email, `%${runId}@example.test`)

  async function createUser(label: string): Promise<string> {
    const email = `${label}-${crypto.randomUUID()}-${runId}@example.test`
    const [user] = await ownerDb
      .insert(users)
      .values({ email, displayName: label })
      .returning({ id: users.id })
    if (!user) {
      throw new Error(`Could not create user ${label}`)
    }
    return user.id
  }

  function createWorkspaceOwnedBy(ownerUserId: string, name: string) {
    return createWorkspace(appDb, { name: `${name} ${runId}`, ownerUserId })
  }

  async function removeEverything() {
    const runUserIds = ownerDb.select({ id: users.id }).from(users).where(runEmails)
    await ownerDb.delete(workspaces).where(inArray(workspaces.createdByUserId, runUserIds))
    await ownerDb.delete(users).where(runEmails)
  }

  return { runId, createUser, createWorkspaceOwnedBy, removeEverything }
}
