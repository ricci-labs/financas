import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { POSTGRES_UNIQUE_VIOLATION, postgresErrorCode } from '@api/core/db/errors'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, parseOrThrow } from '@api/core/http/errors'
import {
  insertContact,
  lockActiveContact,
  selectActiveContacts,
  updateContact,
} from '@api/modules/contacts/contacts.repository'
import type {
  ContactBalanceItem,
  ContactItem,
  ContactRef,
  ContactRow,
  ContactsContext,
  CreatedContact,
  DeleteContactInput,
} from '@api/modules/contacts/contacts.types'
import { readContactPostings } from '@api/modules/ledger'
import { currentWorkspaceDefaults } from '@api/modules/workspaces'
import {
  type ContactBalance,
  contactBalances,
  contactChangeSchema,
  type IsoDate,
  newContactSchema,
  todayIn,
} from '@financas/shared'

const CONTACT_INVALID = 'CONTACT_INVALID'

export function listContacts(db: Database, workspaceId: string): Promise<ContactItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => (await selectActiveContacts(tx)).map(itemOf))
}

export function listContactBalances(
  db: Database,
  workspaceId: string,
  clock: Clock = systemClock,
): Promise<ContactBalanceItem[]> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const { timezone } = await currentWorkspaceDefaults(tx)
    const names = new Map(
      (await selectActiveContacts(tx)).map((contact) => [contact.id, contact.name]),
    )
    return contactBalances(await readContactPostings(tx), todayIn(timezone, clock.now()))
      .filter((balance) => names.has(balance.contactId))
      .map((balance) => ({ ...balance, name: names.get(balance.contactId) ?? '' }))
      .sort((left, right) => left.name.localeCompare(right.name))
  })
}

export async function readContactBalanceFacts(
  tx: WorkspaceTransaction,
  today: IsoDate,
): Promise<ContactBalance[]> {
  const active = new Set((await selectActiveContacts(tx)).map((contact) => contact.id))
  return contactBalances(await readContactPostings(tx), today).filter((balance) =>
    active.has(balance.contactId),
  )
}

export async function createContact(
  db: Database,
  { workspaceId }: ContactsContext,
  rawInput: unknown,
): Promise<CreatedContact> {
  const contact = parseOrThrow(newContactSchema, rawInput, CONTACT_INVALID)
  return refusingTakenPhones(() =>
    withWorkspace(db, workspaceId, async (tx) => ({
      contactId: await insertContact(tx, { workspaceId, ...contact }),
    })),
  )
}

export async function changeContact(
  db: Database,
  { workspaceId, contactId }: ContactRef,
  rawChange: unknown,
  clock: Clock = systemClock,
): Promise<void> {
  const { isOptedOut, isArchived, ...change } = parseOrThrow(
    contactChangeSchema,
    rawChange,
    CONTACT_INVALID,
  )
  await refusingTakenPhones(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      const current = await lockExistingContact(tx, contactId)
      if (isArchived) {
        await assertNothingOwed(tx, contactId)
      }
      await updateContact(tx, contactId, {
        ...change,
        optedOutAt:
          isOptedOut === undefined ? current.optedOutAt : optOutMoment(current, isOptedOut, clock),
        archivedAt:
          isArchived === undefined ? current.archivedAt : archiveMoment(current, isArchived, clock),
      })
    }),
  )
}

export async function deleteContact(
  db: Database,
  { workspaceId, contactId, userId, reason }: DeleteContactInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockExistingContact(tx, contactId)
    await updateContact(tx, contactId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: reason ?? null,
    })
  })
}

async function lockExistingContact(
  tx: WorkspaceTransaction,
  contactId: string,
): Promise<ContactRow> {
  const contact = await lockActiveContact(tx, contactId)
  if (!contact) {
    throw new NotFoundError('CONTACT_NOT_FOUND', `Contact ${contactId} not found`)
  }
  return contact
}

async function assertNothingOwed(tx: WorkspaceTransaction, contactId: string): Promise<void> {
  const owed = (await readContactPostings(tx, contactId)).reduce(
    (sum, posting) => sum + posting.amountCents,
    0,
  )
  if (owed !== 0) {
    throw new ConflictError(
      'CONTACT_HAS_BALANCE',
      'Settle the balance before archiving the contact',
    )
  }
}

function archiveMoment(current: ContactRow, isArchived: boolean, clock: Clock): Date | null {
  if (!isArchived) {
    return null
  }
  return current.archivedAt ?? clock.now()
}

function optOutMoment(current: ContactRow, isOptedOut: boolean, clock: Clock): Date | null {
  if (!isOptedOut) {
    return null
  }
  return current.optedOutAt ?? clock.now()
}

async function refusingTakenPhones<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION) {
      throw new ConflictError('CONTACT_PHONE_TAKEN', 'Another contact has this phone', {
        cause: error,
      })
    }
    throw error
  }
}

function itemOf(contact: ContactRow): ContactItem {
  return {
    id: contact.id,
    name: contact.name,
    phoneE164: contact.phoneE164,
    pixKey: contact.pixKey,
    notes: contact.notes,
    isOptedOut: contact.optedOutAt !== null,
    isArchived: contact.archivedAt !== null,
  }
}
