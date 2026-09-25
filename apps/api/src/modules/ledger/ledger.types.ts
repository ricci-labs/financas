import type { AccountKind } from '@financas/shared'

export type NewLedgerAccount = {
  workspaceId: string
  kind: AccountKind
  name: string
  currency: string
}
