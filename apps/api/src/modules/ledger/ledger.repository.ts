import type { WorkspaceTransaction } from '@api/core/db/tx'
import {
  cardDetails,
  journalEntries,
  ledgerAccounts,
  postings,
} from '@api/modules/ledger/ledger.table'
import type { NewLedgerAccount } from '@api/modules/ledger/ledger.types'
import type { SystemAccountKind } from '@financas/shared'
import { and, eq, inArray, isNull } from 'drizzle-orm'

type NewEntry = typeof journalEntries.$inferInsert

type NewPosting = typeof postings.$inferInsert

export async function insertAccounts(tx: WorkspaceTransaction, accounts: NewLedgerAccount[]) {
  await tx.insert(ledgerAccounts).values(accounts)
}

export function findUsableAccounts(tx: WorkspaceTransaction, accountIds: string[]) {
  return tx
    .select({ id: ledgerAccounts.id, kind: ledgerAccounts.kind })
    .from(ledgerAccounts)
    .where(
      and(
        inArray(ledgerAccounts.id, accountIds),
        isNull(ledgerAccounts.archivedAt),
        isNull(ledgerAccounts.deletedAt),
      ),
    )
}

export async function findSystemAccount(tx: WorkspaceTransaction, kind: SystemAccountKind) {
  const [account] = await tx
    .select({ id: ledgerAccounts.id, kind: ledgerAccounts.kind })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.kind, kind), isNull(ledgerAccounts.deletedAt)))
  if (!account) {
    throw new Error(`System account ${kind} is missing`)
  }
  return account
}

export async function insertEntry(tx: WorkspaceTransaction, entry: NewEntry) {
  const [inserted] = await tx
    .insert(journalEntries)
    .values(entry)
    .returning({ id: journalEntries.id })
  if (!inserted) {
    throw new Error('Entry was not inserted')
  }
  return inserted.id
}

export async function insertPostings(tx: WorkspaceTransaction, lines: NewPosting[]) {
  await tx.insert(postings).values(lines)
}

export async function lockEntry(tx: WorkspaceTransaction, entryId: string) {
  const [entry] = await tx
    .select({ id: journalEntries.id, deletedAt: journalEntries.deletedAt })
    .from(journalEntries)
    .where(eq(journalEntries.id, entryId))
    .for('update')
  return entry
}

export async function markEntryDeleted(
  tx: WorkspaceTransaction,
  entryId: string,
  deletion: { deletedAt: Date; deletedByUserId: string; deleteReason: string | null },
) {
  await tx.update(journalEntries).set(deletion).where(eq(journalEntries.id, entryId))
}

export async function markEntryRestored(tx: WorkspaceTransaction, entryId: string) {
  await tx
    .update(journalEntries)
    .set({ deletedAt: null, deletedByUserId: null, deleteReason: null })
    .where(eq(journalEntries.id, entryId))
}

export async function updateEntryDetails(
  tx: WorkspaceTransaction,
  entryId: string,
  details: { description?: string; notes?: string | null },
) {
  await tx.update(journalEntries).set(details).where(eq(journalEntries.id, entryId))
}

type NewAccount = typeof ledgerAccounts.$inferInsert

type AccountUpdate = Partial<
  Pick<NewAccount, 'name' | 'parentId' | 'ownerUserId' | 'color' | 'icon' | 'sortOrder'>
>

export async function insertAccount(tx: WorkspaceTransaction, account: NewAccount) {
  const [inserted] = await tx
    .insert(ledgerAccounts)
    .values(account)
    .returning({ id: ledgerAccounts.id })
  if (!inserted) {
    throw new Error('Account was not inserted')
  }
  return inserted.id
}

export async function findAccountClass(tx: WorkspaceTransaction, accountId: string) {
  const [account] = await tx
    .select({ class: ledgerAccounts.class, deletedAt: ledgerAccounts.deletedAt })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, accountId))
  return account
}

export async function lockAccount(tx: WorkspaceTransaction, accountId: string) {
  const [account] = await tx
    .select({
      id: ledgerAccounts.id,
      class: ledgerAccounts.class,
      deletedAt: ledgerAccounts.deletedAt,
    })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, accountId))
    .for('update')
  return account
}

export async function updateAccount(
  tx: WorkspaceTransaction,
  accountId: string,
  changes: AccountUpdate & { archivedAt?: Date | null },
) {
  await tx.update(ledgerAccounts).set(changes).where(eq(ledgerAccounts.id, accountId))
}

export async function markAccountDeleted(
  tx: WorkspaceTransaction,
  accountId: string,
  deletion: { deletedAt: Date; deletedByUserId: string; deleteReason: string | null },
) {
  await tx.update(ledgerAccounts).set(deletion).where(eq(ledgerAccounts.id, accountId))
}

export async function markAccountRestored(tx: WorkspaceTransaction, accountId: string) {
  await tx
    .update(ledgerAccounts)
    .set({ deletedAt: null, deletedByUserId: null, deleteReason: null })
    .where(eq(ledgerAccounts.id, accountId))
}

type NewCardDetails = typeof cardDetails.$inferInsert

type CardDetailsUpdate = Partial<
  Pick<
    NewCardDetails,
    | 'closingDay'
    | 'dueDay'
    | 'purchaseOnClosingDayGoesNext'
    | 'limitCents'
    | 'holderUserId'
    | 'paymentAccountId'
  >
>

export async function insertCardDetails(tx: WorkspaceTransaction, details: NewCardDetails) {
  await tx.insert(cardDetails).values(details)
}

export async function lockCardDetails(tx: WorkspaceTransaction, cardAccountId: string) {
  const [details] = await tx
    .select({ accountId: cardDetails.accountId })
    .from(cardDetails)
    .where(eq(cardDetails.accountId, cardAccountId))
    .for('update')
  return details
}

export async function updateCardDetails(
  tx: WorkspaceTransaction,
  cardAccountId: string,
  changes: CardDetailsUpdate,
) {
  await tx.update(cardDetails).set(changes).where(eq(cardDetails.accountId, cardAccountId))
}
