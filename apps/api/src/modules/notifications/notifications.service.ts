import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { findQuietHours } from '@api/modules/identity'
import { insertNotificationIfNew } from '@api/modules/notifications/notifications.repository'
import type {
  EnqueuedNotification,
  NewNotification,
} from '@api/modules/notifications/notifications.types'
import { currentWorkspaceDefaults } from '@api/modules/workspaces'
import { outsideQuietHours } from '@financas/shared'

export async function enqueueNotification(
  tx: WorkspaceTransaction,
  notification: NewNotification,
): Promise<EnqueuedNotification> {
  const { recipient, dueAt, ...rest } = notification
  const scheduledFor = await scheduleFor(tx, notification)
  const isNew = await insertNotificationIfNew(tx, {
    ...rest,
    recipientUserId: 'userId' in recipient ? recipient.userId : null,
    recipientContactId: 'contactId' in recipient ? recipient.contactId : null,
    scheduledFor,
  })
  return { isNew }
}

async function scheduleFor(
  tx: WorkspaceTransaction,
  { recipient, dueAt }: NewNotification,
): Promise<Date> {
  if (!('userId' in recipient)) {
    return dueAt
  }
  const { timezone } = await currentWorkspaceDefaults(tx)
  return outsideQuietHours(dueAt, timezone, await findQuietHours(tx, recipient.userId))
}
