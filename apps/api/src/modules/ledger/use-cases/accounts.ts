import { type Clock, systemClock } from '@api/core/clock'
import type { Database } from '@api/core/db/client'
import { type WorkspaceTransaction, withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, parseOrThrow, ValidationError } from '@api/core/http/errors'
import {
  findAccountClass,
  insertAccount,
  insertAccounts,
  lockAccount,
  markAccountDeleted,
  markAccountRestored,
  updateAccount,
} from '@api/modules/ledger/ledger.repository'
import type {
  CreatedAccount,
  DeleteAccountInput,
  LedgerContext,
  WorkspaceAccount,
} from '@api/modules/ledger/ledger.types'
import { refusingBrokenRules, refusingTakenAccountNames } from '@api/modules/ledger/use-cases/rules'
import { currentWorkspaceDefaults } from '@api/modules/workspaces'
import {
  type AccountClass,
  accountChangeSchema,
  accountClassOf,
  newAccountSchema,
  SYSTEM_ACCOUNT_KINDS,
  SYSTEM_ACCOUNT_NAMES,
} from '@financas/shared'

const ACCOUNT_INVALID = 'ACCOUNT_INVALID'

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

export async function createAccount(
  db: Database,
  { workspaceId }: LedgerContext,
  rawInput: unknown,
): Promise<CreatedAccount> {
  const input = parseOrThrow(newAccountSchema, rawInput, ACCOUNT_INVALID)
  return refusingTakenAccountNames(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      if (input.parentId) {
        await assertParentFits(tx, input.parentId, accountClassOf(input.kind))
      }
      const { currency } = await currentWorkspaceDefaults(tx)
      const accountId = await insertAccount(tx, {
        workspaceId,
        kind: input.kind,
        name: input.name,
        currency,
        parentId: input.parentId ?? null,
        incomeNature: input.incomeNature ?? null,
        ownerUserId: input.ownerUserId ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder,
      })
      return { accountId }
    }),
  )
}

export async function changeAccount(
  db: Database,
  { workspaceId, accountId }: WorkspaceAccount,
  rawChange: unknown,
): Promise<void> {
  const change = parseOrThrow(accountChangeSchema, rawChange, ACCOUNT_INVALID)
  await refusingTakenAccountNames(() =>
    refusingBrokenRules('ACCOUNT_CHANGE_REFUSED', () =>
      withWorkspace(db, workspaceId, async (tx) => {
        const account = await lockActiveAccount(tx, accountId)
        if (change.parentId) {
          await assertParentFits(tx, change.parentId, account.class)
        }
        await updateAccount(tx, accountId, change)
      }),
    ),
  )
}

export async function archiveAccount(
  db: Database,
  ref: WorkspaceAccount,
  clock: Clock = systemClock,
) {
  await setArchived(db, ref, clock.now())
}

export async function unarchiveAccount(db: Database, ref: WorkspaceAccount) {
  await setArchived(db, ref, null)
}

export async function deleteAccount(
  db: Database,
  { workspaceId, accountId, userId, reason }: DeleteAccountInput,
  clock: Clock = systemClock,
): Promise<void> {
  await refusingBrokenRules('ACCOUNT_CANNOT_BE_DELETED', () =>
    withWorkspace(db, workspaceId, async (tx) => {
      await lockActiveAccount(tx, accountId)
      await markAccountDeleted(tx, accountId, {
        deletedAt: clock.now(),
        deletedByUserId: userId,
        deleteReason: reason ?? null,
      })
    }),
  )
}

export async function restoreAccount(db: Database, { workspaceId, accountId }: WorkspaceAccount) {
  await refusingTakenAccountNames(() =>
    refusingBrokenRules('ACCOUNT_CANNOT_BE_RESTORED', () =>
      withWorkspace(db, workspaceId, async (tx) => {
        const account = await lockAccount(tx, accountId)
        if (!account) {
          throw accountNotFound(accountId)
        }
        if (!account.deletedAt) {
          throw new ConflictError('ACCOUNT_NOT_DELETED', `Account ${accountId} is not deleted`)
        }
        await markAccountRestored(tx, accountId)
      }),
    ),
  )
}

async function setArchived(
  db: Database,
  { workspaceId, accountId }: WorkspaceAccount,
  archivedAt: Date | null,
) {
  await refusingBrokenRules('ACCOUNT_CHANGE_REFUSED', () =>
    withWorkspace(db, workspaceId, async (tx) => {
      await lockActiveAccount(tx, accountId)
      await updateAccount(tx, accountId, { archivedAt })
    }),
  )
}

async function lockActiveAccount(tx: WorkspaceTransaction, accountId: string) {
  const account = await lockAccount(tx, accountId)
  if (!account) {
    throw accountNotFound(accountId)
  }
  if (account.deletedAt) {
    throw new ConflictError('ACCOUNT_DELETED', `Account ${accountId} is deleted`)
  }
  return account
}

async function assertParentFits(
  tx: WorkspaceTransaction,
  parentId: string,
  childClass: AccountClass,
): Promise<void> {
  const parent = await findAccountClass(tx, parentId)
  if (!parent || parent.deletedAt) {
    throw new ValidationError('PARENT_NOT_AVAILABLE', `Parent account ${parentId} is not available`)
  }
  if (parent.class !== childClass) {
    throw new ValidationError('PARENT_OF_ANOTHER_CLASS', 'A parent must have the same class')
  }
}

function accountNotFound(accountId: string): NotFoundError {
  return new NotFoundError('ACCOUNT_NOT_FOUND', `Account ${accountId} not found`)
}
