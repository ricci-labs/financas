import { type Clock, systemClock } from '@api/core/clock'
import type { Database } from '@api/core/db/client'
import {
  POSTGRES_CHECK_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { type WorkspaceTransaction, withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, ValidationError } from '@api/core/http/errors'
import {
  findSystemAccount,
  findUsableAccounts,
  insertAccounts,
  insertEntry,
  insertPostings,
  lockEntry,
  markEntryDeleted,
  markEntryRestored,
  updateEntryDetails,
} from '@api/modules/ledger/ledger.repository'
import type {
  DeleteEntryInput,
  EntryContext,
  EntryRef,
  RecordedEntry,
} from '@api/modules/ledger/ledger.types'
import {
  type AccountRef,
  type EntryInput,
  type EntryPlan,
  entryDetailsChangeSchema,
  entryInputSchema,
  planPostings,
  SYSTEM_ACCOUNT_KINDS,
  SYSTEM_ACCOUNT_NAMES,
} from '@financas/shared'
import type { z } from 'zod'

type AccountsById = ReadonlyMap<string, AccountRef>

const SPENDER_IS_MEMBER_CONSTRAINT = 'journal_entries_spender_is_member'

export async function createSystemAccounts(
  tx: WorkspaceTransaction,
  workspaceId: string,
  currency: string,
) {
  await insertAccounts(
    tx,
    SYSTEM_ACCOUNT_KINDS.map((kind) => ({
      workspaceId,
      kind,
      name: SYSTEM_ACCOUNT_NAMES[kind],
      currency,
    })),
  )
}

export async function recordEntry(
  db: Database,
  context: EntryContext,
  rawInput: unknown,
): Promise<RecordedEntry> {
  const input = parseEntryInput(rawInput)
  return withWorkspace(db, context.workspaceId, async (tx) => ({
    entryId: await recordParsedEntry(tx, context, input),
  }))
}

async function recordParsedEntry(
  tx: WorkspaceTransaction,
  context: EntryContext,
  input: EntryInput,
  replacesEntryId?: string,
): Promise<string> {
  const plan = await toEntryPlan(tx, input)
  const planned = planPostings(plan)
  if (!planned.ok) {
    throw new ValidationError(planned.violation, `Entry breaks the rule ${planned.violation}`)
  }

  const entryId = await insertEntryWithMemberSpender(tx, {
    workspaceId: context.workspaceId,
    occurredOn: input.occurredOn,
    description: input.description,
    notes: input.notes ?? null,
    entryType: input.entryType,
    paymentMethod: input.paymentMethod ?? null,
    spentByUserId: input.spentByUserId ?? null,
    source: context.source,
    createdByUserId: context.userId,
    replacesEntryId: replacesEntryId ?? null,
  })
  await insertPostings(
    tx,
    planned.postings.map((posting) => ({ ...posting, workspaceId: context.workspaceId, entryId })),
  )
  return entryId
}

export async function changeEntryDetails(
  db: Database,
  { workspaceId, entryId }: EntryRef,
  rawChange: unknown,
): Promise<void> {
  const change = parseOrThrow(entryDetailsChangeSchema, rawChange)
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockActiveEntry(tx, entryId)
    await updateEntryDetails(tx, entryId, change)
  })
}

export async function deleteEntry(
  db: Database,
  { workspaceId, entryId, userId, reason }: DeleteEntryInput,
  clock: Clock = systemClock,
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    await lockActiveEntry(tx, entryId)
    await markEntryDeleted(tx, entryId, {
      deletedAt: clock.now(),
      deletedByUserId: userId,
      deleteReason: reason ?? null,
    })
  })
}

export async function restoreEntry(db: Database, { workspaceId, entryId }: EntryRef) {
  await refusingBrokenRules('ENTRY_CANNOT_BE_RESTORED', () =>
    withWorkspace(db, workspaceId, async (tx) => {
      const entry = await lockEntry(tx, entryId)
      if (!entry) {
        throw entryNotFound(entryId)
      }
      if (!entry.deletedAt) {
        throw new ConflictError('ENTRY_NOT_DELETED', `Entry ${entryId} is not deleted`)
      }
      await markEntryRestored(tx, entryId)
    }),
  )
}

export async function replaceEntry(
  db: Database,
  context: EntryContext,
  entryId: string,
  rawInput: unknown,
  clock: Clock = systemClock,
): Promise<RecordedEntry> {
  const input = parseEntryInput(rawInput)
  return withWorkspace(db, context.workspaceId, async (tx) => {
    await lockActiveEntry(tx, entryId)
    await markEntryDeleted(tx, entryId, {
      deletedAt: clock.now(),
      deletedByUserId: context.userId,
      deleteReason: null,
    })
    return { entryId: await recordParsedEntry(tx, context, input, entryId) }
  })
}

async function lockActiveEntry(tx: WorkspaceTransaction, entryId: string): Promise<void> {
  const entry = await lockEntry(tx, entryId)
  if (!entry) {
    throw entryNotFound(entryId)
  }
  if (entry.deletedAt) {
    throw new ConflictError('ENTRY_ALREADY_DELETED', `Entry ${entryId} is deleted`)
  }
}

function entryNotFound(entryId: string): NotFoundError {
  return new NotFoundError('ENTRY_NOT_FOUND', `Entry ${entryId} not found`)
}

async function refusingBrokenRules<T>(code: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_CHECK_VIOLATION) {
      throw new ConflictError(code, 'The ledger rules refuse this change', { cause: error })
    }
    throw error
  }
}

async function insertEntryWithMemberSpender(
  tx: WorkspaceTransaction,
  entry: Parameters<typeof insertEntry>[1],
): Promise<string> {
  try {
    return await insertEntry(tx, entry)
  } catch (error) {
    if (postgresConstraintName(error) === SPENDER_IS_MEMBER_CONSTRAINT) {
      throw new ValidationError('SPENT_BY_NOT_A_MEMBER', 'Who spent must be a workspace member', {
        cause: error,
      })
    }
    throw error
  }
}

function parseEntryInput(rawInput: unknown): EntryInput {
  return parseOrThrow(entryInputSchema, rawInput)
}

function parseOrThrow<T>(schema: z.ZodType<T>, rawInput: unknown): T {
  const parsed = schema.safeParse(rawInput)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    const field = issue?.path.join('.') || 'entry'
    throw new ValidationError('ENTRY_INVALID', `${field}: ${issue?.message ?? 'invalid'}`)
  }
  return parsed.data
}

async function toEntryPlan(tx: WorkspaceTransaction, input: EntryInput): Promise<EntryPlan> {
  switch (input.entryType) {
    case 'expense': {
      const accounts = await loadAccounts(tx, [input.paidFromAccountId, input.categoryId])
      return {
        entryType: 'expense',
        occurredOn: input.occurredOn,
        amountCents: input.amountCents,
        paidFrom: pick(accounts, input.paidFromAccountId),
        category: pick(accounts, input.categoryId),
      }
    }
    case 'income': {
      const accounts = await loadAccounts(tx, [input.receivedInAccountId, input.categoryId])
      return {
        entryType: 'income',
        occurredOn: input.occurredOn,
        amountCents: input.amountCents,
        receivedIn: pick(accounts, input.receivedInAccountId),
        category: pick(accounts, input.categoryId),
      }
    }
    case 'transfer': {
      const accounts = await loadAccounts(tx, [input.fromAccountId, input.toAccountId])
      return {
        entryType: 'transfer',
        occurredOn: input.occurredOn,
        amountCents: input.amountCents,
        from: pick(accounts, input.fromAccountId),
        to: pick(accounts, input.toAccountId),
      }
    }
    case 'opening_balance': {
      const accounts = await loadAccounts(tx, [input.accountId])
      return {
        entryType: 'opening_balance',
        occurredOn: input.occurredOn,
        balanceCents: input.balanceCents,
        account: pick(accounts, input.accountId),
        openingBalanceAccount: await findSystemAccount(tx, 'opening_balance'),
      }
    }
  }
}

async function loadAccounts(tx: WorkspaceTransaction, accountIds: string[]): Promise<AccountsById> {
  const found = await findUsableAccounts(tx, accountIds)
  return new Map(found.map((account) => [account.id, account]))
}

function pick(accounts: AccountsById, accountId: string): AccountRef {
  const account = accounts.get(accountId)
  if (!account) {
    throw new ValidationError('ACCOUNT_NOT_AVAILABLE', `Account ${accountId} is not available`)
  }
  return account
}
