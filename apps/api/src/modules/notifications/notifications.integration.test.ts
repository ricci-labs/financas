import { withWorkspace } from '@api/core/db/tx'
import { changeUserPreferences } from '@api/modules/identity/identity.service'
import { enqueueNotification, type NewNotification } from '@api/modules/notifications'
import { notificationOutbox } from '@api/modules/notifications/notifications.table'
import { workspaces } from '@api/modules/workspaces/workspaces.table'
import { connectTestDatabases, POSTGRES_ERRORS, postgresErrorCodeOf } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)

let userId: string

beforeAll(async () => {
  userId = await fixtures.createUser('notified')
})

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

function reminder(workspaceId: string, overrides: Partial<NewNotification> = {}): NewNotification {
  return {
    workspaceId,
    recipient: { userId },
    channel: 'email',
    kind: 'bill_reminder',
    payload: { description: 'Aluguel' },
    dueAt: new Date('2026-10-15T15:00:00Z'),
    dedupeKey: 'bill_reminder:rent:3',
    ...overrides,
  }
}

function enqueue(workspaceId: string, notification: NewNotification) {
  return withWorkspace(databases.app, workspaceId, (tx) => enqueueNotification(tx, notification))
}

async function rowsOf(workspaceId: string) {
  return databases.owner
    .select()
    .from(notificationOutbox)
    .where(eq(notificationOutbox.workspaceId, workspaceId))
}

describe('enqueueNotification', () => {
  it('queues a notification once per dedupe key', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Dedupe')
    expect(await enqueue(workspaceId, reminder(workspaceId))).toEqual({ isNew: true })
    expect(await enqueue(workspaceId, reminder(workspaceId))).toEqual({ isNew: false })
    const rows = await rowsOf(workspaceId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 0, recipientUserId: userId })
  })

  it("waits for the end of the member's quiet hours, in the workspace time zone", async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Quiet')
    await changeUserPreferences(databases.app, userId, {
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    await enqueue(workspaceId, reminder(workspaceId, { dueAt: new Date('2026-10-16T02:00:00Z') }))
    const [row] = await rowsOf(workspaceId)
    expect(row?.scheduledFor.toISOString()).toBe('2026-10-16T10:00:00.000Z')
  })
})

describe('notification_outbox table', () => {
  it('needs exactly one recipient and a sent time only once sent', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Outbox checks')
    const insert = (values: Partial<typeof notificationOutbox.$inferInsert>) =>
      withWorkspace(databases.app, workspaceId, (tx) =>
        tx.insert(notificationOutbox).values({
          workspaceId,
          channel: 'email',
          kind: 'digest',
          payload: {},
          scheduledFor: new Date(),
          dedupeKey: crypto.randomUUID(),
          ...values,
        }),
      )
    expect(await postgresErrorCodeOf(insert({}))).toBe(POSTGRES_ERRORS.checkViolation)
    expect(await postgresErrorCodeOf(insert({ recipientUserId: userId, status: 'sent' }))).toBe(
      POSTGRES_ERRORS.checkViolation,
    )
    expect(await postgresErrorCodeOf(insert({ recipientUserId: userId }))).toBeUndefined()
  })

  it('goes away with the workspace when it is erased', async () => {
    const { workspaceId } = await fixtures.createWorkspaceOwnedBy(userId, 'Erase outbox')
    await enqueue(workspaceId, reminder(workspaceId))
    const erase = databases.owner.delete(workspaces).where(eq(workspaces.id, workspaceId))
    expect(await postgresErrorCodeOf(erase)).toBeUndefined()
  })
})
