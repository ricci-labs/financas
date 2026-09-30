import type { WorkspaceTransaction } from '@api/core/db/db.types'
import type { AuditTarget } from '@api/modules/audit'
import {
  chargeItems,
  chargePayments,
  charges,
  contacts,
} from '@api/modules/contacts/contacts.table'
import type {
  ChargeItemRow,
  ChargePaymentRow,
  ChargeRow,
  ChargeUpdate,
  ContactRow,
  ContactUpdate,
  NewChargeItemRow,
  NewChargePaymentRow,
  NewChargeRow,
  NewContactRow,
} from '@api/modules/contacts/contacts.types'
import { OPEN_CHARGE_STATUSES } from '@financas/shared'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'

export function selectActiveContacts(tx: WorkspaceTransaction): Promise<ContactRow[]> {
  return tx
    .select()
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(contacts.name), asc(contacts.id))
}

export async function selectActiveContact(
  tx: WorkspaceTransaction,
  contactId: string,
): Promise<ContactRow | undefined> {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
  return contact
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

export async function selectPostingsInOpenCharges(
  tx: WorkspaceTransaction,
  contactId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ postingId: chargeItems.postingId })
    .from(chargeItems)
    .innerJoin(charges, eq(charges.id, chargeItems.chargeId))
    .where(
      and(eq(charges.contactId, contactId), inArray(charges.status, [...OPEN_CHARGE_STATUSES])),
    )
  return rows.map((row) => row.postingId)
}

export async function insertCharge(
  tx: WorkspaceTransaction,
  charge: NewChargeRow,
): Promise<string> {
  const [inserted] = await tx.insert(charges).values(charge).returning({ id: charges.id })
  if (!inserted) {
    throw new Error('Charge was not inserted')
  }
  return inserted.id
}

export async function insertChargeItems(
  tx: WorkspaceTransaction,
  items: NewChargeItemRow[],
): Promise<void> {
  await tx.insert(chargeItems).values(items)
}

export async function updateCharge(
  tx: WorkspaceTransaction,
  chargeId: string,
  update: ChargeUpdate,
): Promise<void> {
  await tx.update(charges).set(update).where(eq(charges.id, chargeId))
}

export async function lockCharge(
  tx: WorkspaceTransaction,
  chargeId: string,
): Promise<ChargeRow | undefined> {
  const [charge] = await tx.select().from(charges).where(eq(charges.id, chargeId)).for('update')
  return charge
}

export async function selectChargeExists(
  tx: WorkspaceTransaction,
  chargeId: string,
): Promise<boolean> {
  const [charge] = await tx.select({ id: charges.id }).from(charges).where(eq(charges.id, chargeId))
  return charge !== undefined
}

export async function selectCharge(
  tx: WorkspaceTransaction,
  chargeId: string,
): Promise<ChargeRow | undefined> {
  const [charge] = await tx.select().from(charges).where(eq(charges.id, chargeId))
  return charge
}

export function selectCharges(tx: WorkspaceTransaction, contactId?: string): Promise<ChargeRow[]> {
  return tx
    .select()
    .from(charges)
    .where(contactId ? eq(charges.contactId, contactId) : undefined)
    .orderBy(desc(charges.createdAt), desc(charges.id))
}

export function selectChargeItems(
  tx: WorkspaceTransaction,
  chargeIds: string[],
): Promise<ChargeItemRow[]> {
  return tx
    .select({
      chargeId: chargeItems.chargeId,
      postingId: chargeItems.postingId,
      amountCents: chargeItems.amountCents,
    })
    .from(chargeItems)
    .where(inArray(chargeItems.chargeId, chargeIds))
}

export async function insertChargePayment(
  tx: WorkspaceTransaction,
  payment: NewChargePaymentRow,
): Promise<string> {
  const [inserted] = await tx
    .insert(chargePayments)
    .values(payment)
    .returning({ id: chargePayments.id })
  if (!inserted) {
    throw new Error('Charge payment was not inserted')
  }
  return inserted.id
}

export function selectChargePayments(
  tx: WorkspaceTransaction,
  chargeIds: string[],
): Promise<ChargePaymentRow[]> {
  return tx
    .select({
      chargeId: chargePayments.chargeId,
      entryId: chargePayments.entryId,
      amountCents: chargePayments.amountCents,
    })
    .from(chargePayments)
    .where(inArray(chargePayments.chargeId, chargeIds))
}

export function contactAuditTarget(workspaceId: string, contactId: string): AuditTarget {
  return { workspaceId, table: contacts, key: contacts.id, rowId: contactId }
}

export function chargeAuditTarget(workspaceId: string, chargeId: string): AuditTarget {
  return { workspaceId, table: charges, key: charges.id, rowId: chargeId }
}

export function chargePaymentAuditTarget(workspaceId: string, paymentId: string): AuditTarget {
  return { workspaceId, table: chargePayments, key: chargePayments.id, rowId: paymentId }
}
