import type { WorkspaceTransaction } from '@api/core/db/tx'
import { insertAccounts } from '@api/modules/ledger/ledger.repository'
import { SYSTEM_ACCOUNT_KINDS, SYSTEM_ACCOUNT_NAMES } from '@financas/shared'

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
