import type { notificationOutbox } from '@api/modules/notifications/notifications.table'
import type { NotificationKind } from '@financas/shared'

export type NotificationRow = typeof notificationOutbox.$inferSelect

export type NewNotificationRow = typeof notificationOutbox.$inferInsert

export type NotificationRecipient = { userId: string } | { contactId: string }

export type NewNotification = {
  workspaceId: string
  recipient: NotificationRecipient
  channel: 'email' | 'whatsapp'
  kind: NotificationKind
  payload: Record<string, unknown>
  dueAt: Date
  dedupeKey: string
}

export type EnqueuedNotification = {
  isNew: boolean
}
