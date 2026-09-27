import type { Clock } from '@api/core/clock.types'
import type { Mailer } from '@api/core/email/email.types'
import type { Logger } from '@api/core/observability/logger'
import type { EmailRecipient } from '@api/modules/identity'
import type { InvoiceDue } from '@api/modules/ledger'
import type { notificationOutbox } from '@api/modules/notifications/notifications.table'
import type { OccurrenceRow } from '@api/modules/planning'
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

export type NotificationEmailInput = {
  kind: NotificationKind
  payload: unknown
  recipient: EmailRecipient
  appLink: string
}

export type DeliveryDeps = {
  mailer: Mailer
  publicUrl: string
  clock: Clock
  logger: Logger
}

export type DeliveryResult = {
  sent: number
  retried: number
  failed: number
}

export type DeliveryOutcome = keyof DeliveryResult

export type NotificationUpdate = Partial<
  Pick<NewNotificationRow, 'status' | 'attempts' | 'lastError' | 'sentAt' | 'scheduledFor'>
>

export type ReminderSources = {
  bills: OccurrenceRow[]
  invoices: InvoiceDue[]
}
