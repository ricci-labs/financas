import type { Database } from '@api/core/db/db.types'
import type { contacts } from '@api/modules/contacts/contacts.table'
import type { ContactBalance } from '@financas/shared'

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
