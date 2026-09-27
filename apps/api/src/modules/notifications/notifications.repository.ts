import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { notificationOutbox } from '@api/modules/notifications/notifications.table'
import type {
  NewNotificationRow,
  NotificationRow,
  NotificationUpdate,
} from '@api/modules/notifications/notifications.types'
import { and, asc, eq, lte } from 'drizzle-orm'

export async function insertNotificationIfNew(
  tx: WorkspaceTransaction,
  notification: NewNotificationRow,
): Promise<boolean> {
  const inserted = await tx
    .insert(notificationOutbox)
    .values(notification)
    .onConflictDoNothing({ target: [notificationOutbox.workspaceId, notificationOutbox.dedupeKey] })
    .returning({ id: notificationOutbox.id })
  return inserted.length > 0
}

export function claimDueEmails(
  tx: WorkspaceTransaction,
  now: Date,
  limit: number,
): Promise<NotificationRow[]> {
  return tx
    .select()
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.status, 'pending'),
        eq(notificationOutbox.channel, 'email'),
        lte(notificationOutbox.scheduledFor, now),
      ),
    )
    .orderBy(asc(notificationOutbox.scheduledFor))
    .limit(limit)
    .for('update', { skipLocked: true })
}

export async function updateNotification(
  tx: WorkspaceTransaction,
  notificationId: string,
  update: NotificationUpdate,
): Promise<void> {
  await tx.update(notificationOutbox).set(update).where(eq(notificationOutbox.id, notificationId))
}
