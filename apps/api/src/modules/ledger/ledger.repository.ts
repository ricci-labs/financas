import type { WorkspaceTransaction } from '@api/core/db/tx'
import { journalEntries, ledgerAccounts, postings } from '@api/modules/ledger/ledger.table'
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
