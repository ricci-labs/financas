import { createAccount, createCard, recordEntry } from '@api/modules/ledger'
import { membershipPreferences } from '@api/modules/members/members.table'
import { queueReminders } from '@api/modules/notifications'
import { notificationOutbox } from '@api/modules/notifications/notifications.table'
import { createRecurrenceRule } from '@api/modules/planning'
import { connectTestDatabases } from '@api/testing/database'
import { createFixtures } from '@api/testing/fixtures'
import { addMemberWithSystemRole } from '@api/testing/http'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

const databases = connectTestDatabases()
const fixtures = createFixtures(databases.owner, databases.app)
const clockAt = (iso: string) => ({ now: () => new Date(iso) })
const OCTOBER_15 = clockAt('2026-10-15T12:00:00Z')

afterAll(async () => {
  await fixtures.removeEverything()
  await databases.closeAll()
})

async function household() {
  const ownerId = await fixtures.createUser(`remind-owner-${crypto.randomUUID().slice(0, 6)}`)
  const partnerId = await fixtures.createUser(`remind-partner-${crypto.randomUUID().slice(0, 6)}`)
  const { workspaceId } = await fixtures.createWorkspaceOwnedBy(ownerId, 'Reminders')
  await addMemberWithSystemRole(databases.app, databases.owner, workspaceId, partnerId, 'member')
  await databases.owner
    .update(membershipPreferences)
    .set({ notifyBillsDaysBefore: 10 })
    .where(
      and(
        eq(membershipPreferences.workspaceId, workspaceId),
        eq(membershipPreferences.userId, partnerId),
      ),
    )
  const context = { workspaceId, userId: ownerId }
  const account = async (input: Record<string, unknown>) =>
    (await createAccount(databases.app, context, input)).accountId
  const checking = await account({ kind: 'checking', name: 'Conta X' })
  const housing = await account({ kind: 'expense_category', name: 'Moradia' })
  const card = (
    await createCard(databases.app, context, { name: 'Card X', closingDay: 3, dueDay: 10 })
  ).accountId
  const rule = (
    description: string,
    dayOfMonth: number,
    entryType = 'expense',
    source = checking,
  ) =>
    createRecurrenceRule(
      databases.app,
      context,
      {
        description,
        entryType,
        amountCents: 10_000,
        sourceAccountId: source,
        categoryAccountId: housing,
        schedule: {
          frequency: 'monthly',
          dayOfMonth,
          startsOn: `2026-10-${String(dayOfMonth).padStart(2, '0')}`,
        },
      },
      OCTOBER_15,
    )
  await rule('Aluguel', 20)
  await rule('Luz', 25)
  await rule('Streaming', 18, 'card_purchase', card)
  await recordEntry(
    databases.app,
    { ...context, source: 'web' },
    {
      entryType: 'card_purchase',
      occurredOn: '2026-10-14',
      description: 'Mercado',
      amountCents: 30_000,
      cardAccountId: card,
      categoryId: housing,
    },
    OCTOBER_15,
  )
  const queued = async () =>
    (
      await databases.owner
        .select({
          userId: notificationOutbox.recipientUserId,
          kind: notificationOutbox.kind,
          payload: notificationOutbox.payload,
        })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.workspaceId, workspaceId))
    ).map(
      (row) =>
        `${row.userId === ownerId ? 'owner' : 'partner'} ${row.kind} ${(row.payload as { description?: string; cardName?: string }).description ?? (row.payload as { cardName: string }).cardName}`,
    )
  return { workspaceId, queued }
}

describe('queueReminders', () => {
  it('reminds each member of the bills due within their own lead time, once', async () => {
    const { workspaceId, queued } = await household()
    const october17 = clockAt('2026-10-17T12:00:00Z')

    expect(await queueReminders(databases.app, workspaceId, october17)).toBe(3)
    expect((await queued()).sort()).toEqual([
      'owner bill_reminder Aluguel',
      'partner bill_reminder Aluguel',
      'partner bill_reminder Luz',
    ])
    expect(await queueReminders(databases.app, workspaceId, october17)).toBe(0)
  })

  it('reminds of the card invoice as its due date gets close', async () => {
    const { workspaceId, queued } = await household()
    await queueReminders(databases.app, workspaceId, clockAt('2026-11-07T12:00:00Z'))
    expect((await queued()).filter((line) => line.includes('invoice_reminder')).sort()).toEqual([
      'owner invoice_reminder Card X',
      'partner invoice_reminder Card X',
    ])
  })
})
