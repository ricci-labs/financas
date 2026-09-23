import { withWorkspace } from '@api/core/db/tx'
import { users } from '@api/modules/identity/identity.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases } from '@api/testing/database'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const runId = crypto.randomUUID()

let workspaceA: string
let workspaceB: string
let ownerUserId: string

beforeAll(async () => {
  const [user] = await databases.owner
    .insert(users)
    .values({ email: `rls-${runId}@example.test`, displayName: 'RLS test' })
    .returning({ id: users.id })
  if (!user) {
    throw new Error('Could not create the test user')
  }
  ownerUserId = user.id

  const created = await databases.owner
    .insert(workspaces)
    .values([
      { name: `A ${runId}`, createdByUserId: ownerUserId },
      { name: `B ${runId}`, createdByUserId: ownerUserId },
    ])
    .returning({ id: workspaces.id })
  const [first, second] = created
  if (!first || !second) {
    throw new Error('Could not create the test workspaces')
  }
  workspaceA = first.id
  workspaceB = second.id
})

afterAll(async () => {
  await databases.owner.delete(workspaces).where(eq(workspaces.createdByUserId, ownerUserId))
  await databases.owner.delete(users).where(eq(users.id, ownerUserId))
  await databases.closeAll()
})

describe('workspace isolation (RLS)', () => {
  it('shows no workspace at all when no workspace is set', async () => {
    const visible = await databases.app.select().from(workspaces)
    expect(visible).toEqual([])
  })

  it('shows only the current workspace', async () => {
    const visible = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx.select({ id: workspaces.id }).from(workspaces),
    )
    expect(visible).toEqual([{ id: workspaceA }])
  })

  it('cannot update another workspace', async () => {
    const updated = await withWorkspace(databases.app, workspaceA, (tx) =>
      tx
        .update(workspaces)
        .set({ name: 'hijacked' })
        .where(eq(workspaces.id, workspaceB))
        .returning({ id: workspaces.id }),
    )
    expect(updated).toEqual([])

    const [untouched] = await databases.owner
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceB))
    expect(untouched?.name).toBe(`B ${runId}`)
  })

  it('cannot insert a row for another workspace', async () => {
    const insertIntoOtherWorkspace = withWorkspace(databases.app, workspaceA, (tx) =>
      tx.insert(workspaces).values({ name: 'intruder', createdByUserId: ownerUserId }),
    )
    await expect(insertIntoOtherWorkspace).rejects.toThrow()
  })

  it('does not leak the workspace setting after the transaction ends', async () => {
    await withWorkspace(databases.app, workspaceA, (tx) => tx.select().from(workspaces))
    const visibleAfterwards = await databases.app.select().from(workspaces)
    expect(visibleAfterwards).toEqual([])
  })
})
