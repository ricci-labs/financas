import type { Database } from '@api/core/db/db.types'
import type {
  chargeItems,
  chargePayments,
  charges,
  contacts,
} from '@api/modules/contacts/contacts.table'
import type { ChargeStatus, ContactBalance } from '@financas/shared'

export type ContactRow = typeof contacts.$inferSelect

export type NewContactRow = typeof contacts.$inferInsert

export type ContactUpdate = Partial<
  Omit<NewContactRow, 'workspaceId' | 'id' | 'createdAt' | 'updatedAt'>
>

export type ContactItem = {
  id: string
  name: string
  phoneE164: string | null
  pixKey: string | null
  notes: string | null
  isOptedOut: boolean
  isArchived: boolean
}

export type ContactsContext = {
  workspaceId: string
  userId: string
}

export type ContactRef = {
  workspaceId: string
  contactId: string
}

export type DeleteContactInput = ContactRef & {
  userId: string
  reason?: string
}

export type CreatedContact = {
  contactId: string
}

export type ContactRouteDeps = {
  db: Database
}

export type ContactBalanceItem = ContactBalance & {
  name: string
}

export type ChargeRow = typeof charges.$inferSelect

export type NewChargeRow = typeof charges.$inferInsert

export type NewChargeItemRow = typeof chargeItems.$inferInsert

export type ChargeUpdate = Partial<
  Pick<NewChargeRow, 'status' | 'sentAt' | 'messageText' | 'pixPayload'>
>

export type ChargeItemView = {
  postingId: string
  amountCents: number
}

export type ChargeItemRow = ChargeItemView & {
  chargeId: string
}

export type ChargeView = {
  id: string
  contactId: string
  amountCents: number
  dueOn: string | null
  status: ChargeStatus
  paidCents: number
  messageText: string
  pixPayload: string | null
  sentAt: Date | null
  createdAt: Date
  items: ChargeItemView[]
}

export type ChargeRef = {
  workspaceId: string
  chargeId: string
}

export type CreatedCharge = {
  chargeId: string
}

export type NewChargePaymentRow = typeof chargePayments.$inferInsert

export type ChargePaymentRow = {
  chargeId: string
  entryId: string
  amountCents: number
}

export type RecordedPayment = {
  entryId: string
}
