import type { WorkspaceTransaction } from '@api/core/db/db.types'
import {
  accountBalances,
  cardDetails,
  cardInvoices,
  invoiceTotals,
  journalEntries,
  ledgerAccounts,
  postings,
} from '@api/modules/ledger/ledger.table'
import type {
  AccountUpdate,
  CardDetailsUpdate,
  NewAccount,
  NewCardDetails,
  NewEntry,
  NewInvoice,
  NewLedgerAccount,
  NewPosting,
} from '@api/modules/ledger/ledger.types'
import type { EntryListQuery, InvoiceStatus, SystemAccountKind, TrashQuery } from '@financas/shared'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notExists,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

const ACCOUNT_COLUMNS = {
  id: ledgerAccounts.id,
  parentId: ledgerAccounts.parentId,
  kind: ledgerAccounts.kind,
  class: ledgerAccounts.class,
  name: ledgerAccounts.name,
  currency: ledgerAccounts.currency,
  incomeNature: ledgerAccounts.incomeNature,
  ownerUserId: ledgerAccounts.ownerUserId,
  isSystem: ledgerAccounts.isSystem,
  sortOrder: ledgerAccounts.sortOrder,
  color: ledgerAccounts.color,
  icon: ledgerAccounts.icon,
  archivedAt: ledgerAccounts.archivedAt,
}

const ENTRY_COLUMNS = {
  id: journalEntries.id,
  entryType: journalEntries.entryType,
  occurredOn: journalEntries.occurredOn,
  description: journalEntries.description,
  notes: journalEntries.notes,
  paymentMethod: journalEntries.paymentMethod,
  installmentCount: journalEntries.installmentCount,
  spentByUserId: journalEntries.spentByUserId,
  createdByUserId: journalEntries.createdByUserId,
  source: journalEntries.source,
  replacesEntryId: journalEntries.replacesEntryId,
}

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

export async function findCardCycle(tx: WorkspaceTransaction, cardAccountId: string) {
  const [card] = await tx
    .select({
      closingDay: cardDetails.closingDay,
      dueDay: cardDetails.dueDay,
      purchaseOnClosingDayGoesNext: cardDetails.purchaseOnClosingDayGoesNext,
      paymentAccountId: cardDetails.paymentAccountId,
    })
    .from(cardDetails)
    .where(eq(cardDetails.accountId, cardAccountId))
  return card
}

export function selectInvoicesNotClosed(tx: WorkspaceTransaction, cardAccountId: string) {
  return tx
    .select({
      id: cardInvoices.id,
      closingOn: cardInvoices.closingOn,
      referenceMonth: cardInvoices.referenceMonth,
      status: cardInvoices.status,
    })
    .from(cardInvoices)
    .where(and(eq(cardInvoices.cardAccountId, cardAccountId), ne(cardInvoices.status, 'closed')))
}

export async function setInvoiceStatus(
  tx: WorkspaceTransaction,
  invoiceId: string,
  status: InvoiceStatus,
) {
  await tx.update(cardInvoices).set({ status }).where(eq(cardInvoices.id, invoiceId))
}

export async function insertInvoicesIfMissing(tx: WorkspaceTransaction, invoices: NewInvoice[]) {
  if (invoices.length === 0) {
    return
  }
  await tx.insert(cardInvoices).values(invoices).onConflictDoNothing()
}

export function selectInvoicesOfMonths(
  tx: WorkspaceTransaction,
  cardAccountId: string,
  referenceMonths: string[],
) {
  return tx
    .select({
      id: cardInvoices.id,
      referenceMonth: cardInvoices.referenceMonth,
      dueOn: cardInvoices.dueOn,
      status: cardInvoices.status,
    })
    .from(cardInvoices)
    .where(
      and(
        eq(cardInvoices.cardAccountId, cardAccountId),
        inArray(cardInvoices.referenceMonth, referenceMonths),
      ),
    )
}

export async function findInvoiceOfCard(
  tx: WorkspaceTransaction,
  invoiceId: string,
  cardAccountId: string,
) {
  const [invoice] = await tx
    .select({ id: cardInvoices.id })
    .from(cardInvoices)
    .where(and(eq(cardInvoices.id, invoiceId), eq(cardInvoices.cardAccountId, cardAccountId)))
  return invoice
}

export function selectAccountBalances(tx: WorkspaceTransaction) {
  return tx
    .select({
      accountId: accountBalances.accountId,
      kind: accountBalances.kind,
      class: accountBalances.class,
      balanceCents: accountBalances.balanceCents,
      naturalBalanceCents: accountBalances.naturalBalanceCents,
    })
    .from(accountBalances)
}

export function selectInvoiceTotals(tx: WorkspaceTransaction, cardAccountId: string) {
  return tx
    .select({
      invoiceId: invoiceTotals.invoiceId,
      referenceMonth: invoiceTotals.referenceMonth,
      closingOn: invoiceTotals.closingOn,
      dueOn: invoiceTotals.dueOn,
      status: invoiceTotals.status,
      totalCents: invoiceTotals.totalCents,
      paidCents: invoiceTotals.paidCents,
      dueCents: invoiceTotals.dueCents,
    })
    .from(invoiceTotals)
    .where(eq(invoiceTotals.cardAccountId, cardAccountId))
    .orderBy(asc(invoiceTotals.referenceMonth))
}

export function selectActiveAccounts(tx: WorkspaceTransaction) {
  return tx
    .select(ACCOUNT_COLUMNS)
    .from(ledgerAccounts)
    .where(isNull(ledgerAccounts.deletedAt))
    .orderBy(asc(ledgerAccounts.sortOrder), asc(ledgerAccounts.name))
}

export function selectActiveCards(tx: WorkspaceTransaction) {
  return tx
    .select({
      accountId: ledgerAccounts.id,
      name: ledgerAccounts.name,
      color: ledgerAccounts.color,
      icon: ledgerAccounts.icon,
      sortOrder: ledgerAccounts.sortOrder,
      archivedAt: ledgerAccounts.archivedAt,
      closingDay: cardDetails.closingDay,
      dueDay: cardDetails.dueDay,
      purchaseOnClosingDayGoesNext: cardDetails.purchaseOnClosingDayGoesNext,
      limitCents: cardDetails.limitCents,
      holderUserId: cardDetails.holderUserId,
      paymentAccountId: cardDetails.paymentAccountId,
    })
    .from(cardDetails)
    .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, cardDetails.accountId))
    .where(isNull(ledgerAccounts.deletedAt))
    .orderBy(asc(ledgerAccounts.sortOrder), asc(ledgerAccounts.name))
}

export function selectEntries(tx: WorkspaceTransaction, query: EntryListQuery) {
  const conditions = [isNull(journalEntries.deletedAt)]
  if (query.from) {
    conditions.push(gte(journalEntries.occurredOn, query.from))
  }
  if (query.to) {
    conditions.push(lte(journalEntries.occurredOn, query.to))
  }
  if (query.accountId) {
    const entriesOfAccount = tx
      .select({ entryId: postings.entryId })
      .from(postings)
      .where(eq(postings.accountId, query.accountId))
    conditions.push(inArray(journalEntries.id, entriesOfAccount))
  }
  if (query.cursor) {
    conditions.push(
      sql`(${journalEntries.occurredOn}, ${journalEntries.id}) < (${query.cursor.key}::date, ${query.cursor.id}::uuid)`,
    )
  }
  return tx
    .select(ENTRY_COLUMNS)
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.occurredOn), desc(journalEntries.id))
    .limit(query.limit + 1)
}

export function selectTrashedEntries(tx: WorkspaceTransaction, query: TrashQuery) {
  const replacements = alias(journalEntries, 'replacements')
  const replaced = tx
    .select({ id: replacements.id })
    .from(replacements)
    .where(eq(replacements.replacesEntryId, journalEntries.id))
  const conditions = [isNotNull(journalEntries.deletedAt), notExists(replaced)]
  if (query.cursor) {
    conditions.push(
      sql`(${deletedAtToTheMillisecond(journalEntries)}, ${journalEntries.id}) < (${query.cursor.key}::timestamptz, ${query.cursor.id}::uuid)`,
    )
  }
  return tx
    .select({ ...ENTRY_COLUMNS, ...deletionColumns(journalEntries) })
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(deletedAtToTheMillisecond(journalEntries)), desc(journalEntries.id))
    .limit(query.limit + 1)
}

export function selectTrashedAccounts(tx: WorkspaceTransaction) {
  return tx
    .select({ ...ACCOUNT_COLUMNS, ...deletionColumns(ledgerAccounts) })
    .from(ledgerAccounts)
    .where(isNotNull(ledgerAccounts.deletedAt))
    .orderBy(desc(ledgerAccounts.deletedAt), desc(ledgerAccounts.id))
}

function deletedAtToTheMillisecond(table: typeof journalEntries | typeof ledgerAccounts) {
  return sql`date_trunc('milliseconds', ${table.deletedAt})`
}

function deletionColumns(table: typeof journalEntries | typeof ledgerAccounts) {
  return {
    deletedAt: sql<Date>`${table.deletedAt}`.mapWith(table.deletedAt),
    deletedByUserId: table.deletedByUserId,
    deleteReason: table.deleteReason,
  }
}

export function selectPostingsOfEntries(tx: WorkspaceTransaction, entryIds: string[]) {
  return tx
    .select({
      entryId: postings.entryId,
      lineNo: postings.lineNo,
      accountId: postings.accountId,
      accountKind: postings.accountKind,
      amountCents: postings.amountCents,
      effectiveOn: postings.effectiveOn,
      invoiceId: postings.invoiceId,
      installmentNo: postings.installmentNo,
    })
    .from(postings)
    .where(inArray(postings.entryId, entryIds))
    .orderBy(asc(postings.entryId), asc(postings.lineNo))
}

export function selectInvoiceLines(
  tx: WorkspaceTransaction,
  cardAccountId: string,
  invoiceId: string,
) {
  return tx
    .select({
      entryId: journalEntries.id,
      entryType: journalEntries.entryType,
      occurredOn: journalEntries.occurredOn,
      description: journalEntries.description,
      installmentNo: postings.installmentNo,
      installmentCount: journalEntries.installmentCount,
      cardAmountCents: postings.amountCents,
    })
    .from(postings)
    .innerJoin(journalEntries, eq(journalEntries.id, postings.entryId))
    .where(
      and(
        eq(postings.invoiceId, invoiceId),
        eq(postings.accountId, cardAccountId),
        isNull(journalEntries.deletedAt),
      ),
    )
    .orderBy(asc(journalEntries.occurredOn), asc(journalEntries.id))
}
