import type { WorkspaceTransaction } from '@api/core/db/db.types'
import { selectActiveAccounts, selectPostingFacts } from '@api/modules/ledger/ledger.repository'
import type { FactAccount, FactPosting, IsoDate } from '@financas/shared'

export async function readAccountFacts(tx: WorkspaceTransaction): Promise<FactAccount[]> {
  return (await selectActiveAccounts(tx)).map((account) => ({
    id: account.id,
    parentId: account.parentId,
    kind: account.kind,
    class: account.class,
    incomeNature: account.incomeNature,
  }))
}

export function readPostingFacts(
  tx: WorkspaceTransaction,
  from: IsoDate,
  to: IsoDate,
): Promise<FactPosting[]> {
  return selectPostingFacts(tx, from, to)
}
