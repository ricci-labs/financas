import type { Database } from '@api/core/db/client'
import { type WorkspaceTransaction, withWorkspace } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import {
  findSystemAccount,
  findUsableAccounts,
  insertAccounts,
  insertEntry,
  insertPostings,
} from '@api/modules/ledger/ledger.repository'
import type { EntryContext, RecordedEntry } from '@api/modules/ledger/ledger.types'
import {
  type AccountRef,
  type EntryInput,
  type EntryPlan,
  entryInputSchema,
  planPostings,
  SYSTEM_ACCOUNT_KINDS,
  SYSTEM_ACCOUNT_NAMES,
} from '@financas/shared'

type AccountsById = ReadonlyMap<string, AccountRef>

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

  const entryId = await insertEntry(tx, {
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

function parseEntryInput(rawInput: unknown): EntryInput {
  const parsed = entryInputSchema.safeParse(rawInput)
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
