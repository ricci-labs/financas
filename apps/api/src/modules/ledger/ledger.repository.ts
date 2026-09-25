import type { WorkspaceTransaction } from '@api/core/db/tx'
import { ledgerAccounts } from '@api/modules/ledger/ledger.table'
import type { NewLedgerAccount } from '@api/modules/ledger/ledger.types'

export async function insertAccounts(tx: WorkspaceTransaction, accounts: NewLedgerAccount[]) {
  await tx.insert(ledgerAccounts).values(accounts)
}
