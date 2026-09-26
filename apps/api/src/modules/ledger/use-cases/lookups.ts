import type { WorkspaceTransaction } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import { findUsableAccounts } from '@api/modules/ledger/ledger.repository'
import type { AccountsById } from '@api/modules/ledger/ledger.types'
import type { AccountRef } from '@financas/shared'

export async function loadAccounts(
  tx: WorkspaceTransaction,
  accountIds: string[],
): Promise<AccountsById> {
  const found = await findUsableAccounts(tx, accountIds)
  return new Map(found.map((account) => [account.id, account]))
}

export function pick(accounts: AccountsById, accountId: string): AccountRef {
  const account = accounts.get(accountId)
  if (!account) {
    throw new ValidationError('ACCOUNT_NOT_AVAILABLE', `Account ${accountId} is not available`)
  }
  return account
}
