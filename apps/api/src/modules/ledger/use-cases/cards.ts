import type { Database } from '@api/core/db/client'
import { type WorkspaceTransaction, withWorkspace } from '@api/core/db/tx'
import { NotFoundError, ValidationError } from '@api/core/http/errors'
import {
  findUsableAccounts,
  insertAccount,
  insertCardDetails,
  lockCardDetails,
  updateCardDetails,
} from '@api/modules/ledger/ledger.repository'
import type { CreatedAccount, LedgerContext, WorkspaceCard } from '@api/modules/ledger/ledger.types'
import { parseOrThrow, refusingTakenAccountNames } from '@api/modules/ledger/use-cases/rules'
import { currentWorkspaceDefaults } from '@api/modules/workspaces'
import { cardChangeSchema, isMoneyAccountKind, newCardSchema } from '@financas/shared'

const CARD_INVALID = 'CARD_INVALID'

export async function createCard(
  db: Database,
  { workspaceId }: LedgerContext,
  rawInput: unknown,
): Promise<CreatedAccount> {
  const input = parseOrThrow(newCardSchema, rawInput, CARD_INVALID)
  return refusingTakenAccountNames(() =>
    withWorkspace(db, workspaceId, async (tx) => {
      if (input.paymentAccountId) {
        await assertPaymentAccountUsable(tx, input.paymentAccountId)
      }
      const { currency } = await currentWorkspaceDefaults(tx)
      const accountId = await insertAccount(tx, {
        workspaceId,
        kind: 'credit_card',
        name: input.name,
        currency,
        color: input.color ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder,
      })
      await insertCardDetails(tx, {
        workspaceId,
        accountId,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        purchaseOnClosingDayGoesNext: input.purchaseOnClosingDayGoesNext,
        limitCents: input.limitCents ?? null,
        holderUserId: input.holderUserId ?? null,
        paymentAccountId: input.paymentAccountId ?? null,
      })
      return { accountId }
    }),
  )
}

export async function changeCard(
  db: Database,
  { workspaceId, cardAccountId }: WorkspaceCard,
  rawChange: unknown,
): Promise<void> {
  const change = parseOrThrow(cardChangeSchema, rawChange, CARD_INVALID)
  await withWorkspace(db, workspaceId, async (tx) => {
    const card = await lockCardDetails(tx, cardAccountId)
    if (!card) {
      throw new NotFoundError('CARD_NOT_FOUND', `Card ${cardAccountId} not found`)
    }
    if (change.paymentAccountId) {
      await assertPaymentAccountUsable(tx, change.paymentAccountId)
    }
    await updateCardDetails(tx, cardAccountId, change)
  })
}

async function assertPaymentAccountUsable(tx: WorkspaceTransaction, accountId: string) {
  const [account] = await findUsableAccounts(tx, [accountId])
  if (!account || !isMoneyAccountKind(account.kind)) {
    throw new ValidationError(
      'PAYMENT_ACCOUNT_NOT_AVAILABLE',
      'Invoices are paid from an active money account',
    )
  }
}
