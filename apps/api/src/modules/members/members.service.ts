import type { WorkspaceTransaction } from '@api/core/db/tx'
import { insertMembership } from '@api/modules/members/members.repository'
import type { NewMembership } from '@api/modules/members/members.types'

export function addMember(tx: WorkspaceTransaction, membership: NewMembership): Promise<string> {
  return insertMembership(tx, membership)
}
