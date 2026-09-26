import { type AccountKind, MONEY_ACCOUNT_KINDS } from '@shared/ledger/ledger.constants'
import type { AccountRef } from '@shared/ledger/postings.types'
import type { RecurringEntryType } from '@shared/recurrence/recurrence.constants'
import type { RecurringAccountKinds } from '@shared/recurrence/recurrence.types'

const MONEY_KINDS: ReadonlySet<AccountKind> = new Set(MONEY_ACCOUNT_KINDS)

const ACCOUNTS_OF_ENTRY_TYPE: Record<RecurringEntryType, RecurringAccountKinds> = {
  expense: { source: isMoney, category: (kind) => kind === 'expense_category' },
  income: { source: isMoney, category: (kind) => kind === 'income_category' },
  card_purchase: {
    source: (kind) => kind === 'credit_card',
    category: (kind) => kind === 'expense_category',
  },
  transfer: { source: isMoney, category: isMoney },
}

export function recurringAccountsFit(
  entryType: RecurringEntryType,
  source: AccountRef,
  category: AccountRef,
): boolean {
  const expected = ACCOUNTS_OF_ENTRY_TYPE[entryType]
  return (
    expected.source(source.kind) && expected.category(category.kind) && source.id !== category.id
  )
}

function isMoney(kind: AccountKind): boolean {
  return MONEY_KINDS.has(kind)
}
