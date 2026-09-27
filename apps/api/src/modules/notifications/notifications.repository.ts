import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { notificationOutbox } from '@api/modules/notifications/notifications.table'
import type { NewNotificationRow } from '@api/modules/notifications/notifications.types'

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
