import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { contacts } from '@api/modules/contacts/contacts.table'
import type { ContactRow, ContactUpdate, NewContactRow } from '@api/modules/contacts/contacts.types'
import { and, asc, eq, isNull } from 'drizzle-orm'

export function selectActiveContacts(tx: WorkspaceTransaction): Promise<ContactRow[]> {
  return tx
    .select()
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name), asc(contacts.id))
}

export async function lockActiveContact(
  tx: WorkspaceTransaction,
  contactId: string,
): Promise<ContactRow | undefined> {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
    .for('update')
  return contact
}

export async function insertContact(
  tx: WorkspaceTransaction,
  contact: NewContactRow,
): Promise<string> {
  const [inserted] = await tx.insert(contacts).values(contact).returning({ id: contacts.id })
  if (!inserted) {
    throw new Error('Contact was not inserted')
  }
  return inserted.id
}

export async function updateContact(
  tx: WorkspaceTransaction,
  contactId: string,
  update: ContactUpdate,
): Promise<void> {
  await tx.update(contacts).set(update).where(eq(contacts.id, contactId))
}
