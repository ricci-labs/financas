import type { Clock } from '@api/core/clock.types'
import type { Database } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { type InvoiceDue, readInvoicesDueBetween } from '@api/modules/ledger'
import { type NotificationTarget, readNotificationTargets } from '@api/modules/members'
import type {
  NewNotification,
  ReminderSources,
} from '@api/modules/notifications/notifications.types'
import { enqueueNotification } from '@api/modules/notifications/use-cases/outbox'
import { type OccurrenceRow, readOccurrencesBetween, workspaceToday } from '@api/modules/planning'
import { addDays, type IsoDate } from '@financas/shared'

const REMINDER_CHANNEL = 'email'

export function queueReminders(db: Database, workspaceId: string, clock: Clock): Promise<number> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const targets = await readNotificationTargets(tx)
    if (targets.length === 0) {
      return 0
    }
    const today = await workspaceToday(tx, clock)
    const horizon = addDays(today, Math.max(...targets.map((target) => target.billsDaysBefore)))
    const sources: ReminderSources = {
      bills: (await readOccurrencesBetween(tx, { from: today, to: horizon }, today)).filter(
        (occurrence) => occurrence.status === 'pending' && occurrence.entryType === 'expense',
      ),
      invoices: await readInvoicesDueBetween(tx, today, horizon),
    }
    let queued = 0
    for (const reminder of targets.flatMap((target) =>
      remindersFor(workspaceId, target, sources, today, clock.now()),
    )) {
      queued += (await enqueueNotification(tx, reminder)).isNew ? 1 : 0
    }
    return queued
  })
}

function remindersFor(
  workspaceId: string,
  target: NotificationTarget,
  { bills, invoices }: ReminderSources,
  today: IsoDate,
  now: Date,
): NewNotification[] {
  const lastDay = addDays(today, target.billsDaysBefore)
  const base = {
    workspaceId,
    recipient: { userId: target.userId },
    channel: REMINDER_CHANNEL,
    dueAt: now,
  } as const
  const billReminders = bills
    .filter((bill) => bill.dueOn <= lastDay)
    .map((bill) => ({
      ...base,
      ...billReminder(bill),
      dedupeKey: `bill_reminder:${bill.id}:${target.userId}`,
    }))
  const invoiceReminders = invoices
    .filter((invoice) => invoice.dueOn <= lastDay)
    .map((invoice) => ({
      ...base,
      ...invoiceReminder(invoice),
      dedupeKey: `invoice_reminder:${invoice.invoiceId}:${target.userId}`,
    }))
  return [...billReminders, ...invoiceReminders]
}

function billReminder(bill: OccurrenceRow): Pick<NewNotification, 'kind' | 'payload'> {
  return {
    kind: 'bill_reminder',
    payload: {
      description: bill.description,
      amountCents: bill.amountCents,
      isEstimate: bill.amountIsEstimate,
      dueOn: bill.dueOn,
    },
  }
}

function invoiceReminder(invoice: InvoiceDue): Pick<NewNotification, 'kind' | 'payload'> {
  return {
    kind: 'invoice_reminder',
    payload: { cardName: invoice.cardName, amountCents: invoice.dueCents, dueOn: invoice.dueOn },
  }
}
