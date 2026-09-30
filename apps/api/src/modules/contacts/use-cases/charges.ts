import { systemClock } from '@api/core/clock'
import type { Clock } from '@api/core/clock.types'
import type { Database, WorkspaceTransaction } from '@api/core/db/db.types'
import { withWorkspace } from '@api/core/db/tx'
import { ConflictError, NotFoundError, parseOrThrow } from '@api/core/http/errors'
import { auditCreation, audited } from '@api/modules/audit'
import {
  chargeAuditTarget,
  chargePaymentAuditTarget,
  insertCharge,
  insertChargeItems,
  insertChargePayment,
  lockActiveContact,
  lockCharge,
  selectCharge,
  selectChargeExists,
  selectChargeItems,
  selectChargePayments,
  selectCharges,
  selectPostingsInOpenCharges,
  updateCharge,
} from '@api/modules/contacts/contacts.repository'
import type {
  ChargeRef,
  ChargeRow,
  ChargeView,
  ContactRef,
  CreatedCharge,
  RecordedPayment,
} from '@api/modules/contacts/contacts.types'
import { getAccount } from '@api/modules/identity'
import { activeEntryIdsOf, readContactItems, recordEntryInTransaction } from '@api/modules/ledger'
import { currentWorkspaceSettings } from '@api/modules/workspaces'
import {
  type ChargeStatus,
  chargeMessage,
  chargePaymentSchema,
  chargeStatusOf,
  type IsoDate,
  newChargeSchema,
  OPEN_CHARGE_STATUSES,
  type OpenItem,
  openItems,
  pixCopiaECola,
  todayIn,
} from '@financas/shared'

const PLACEHOLDER_MESSAGE = '…'
const SETTLEMENT_DESCRIPTION = 'Pagamento de cobrança'

export async function createCharge(
  db: Database,
  { workspaceId, contactId }: ContactRef,
  userId: string,
  rawInput: unknown,
  clock: Clock = systemClock,
): Promise<CreatedCharge> {
  const { until } = parseOrThrow(newChargeSchema, rawInput, 'CHARGE_INVALID')
  const requester = await getAccount(db, userId)
  return withWorkspace(db, workspaceId, async (tx) => {
    const contact = await lockActiveContact(tx, contactId)
    if (!contact) {
      throw new NotFoundError('CONTACT_NOT_FOUND', `Contact ${contactId} not found`)
    }
    const settings = await currentWorkspaceSettings(tx)
    const items = await chargeableItemsOf(
      tx,
      contactId,
      until ?? todayIn(settings.timezone, clock.now()),
    )
    if (items.length === 0) {
      throw new ConflictError('NOTHING_TO_CHARGE', 'The contact has nothing open to charge')
    }
    const totalCents = items.reduce((sum, item) => sum + item.remainingCents, 0)
    const dueOn =
      items
        .map((item) => item.effectiveOn)
        .sort()
        .at(-1) ?? null
    const chargeId = await insertCharge(tx, {
      workspaceId,
      contactId,
      amountCents: totalCents,
      dueOn,
      messageText: PLACEHOLDER_MESSAGE,
      createdByUserId: userId,
    })
    await insertChargeItems(
      tx,
      items.map((item) => ({
        workspaceId,
        chargeId,
        postingId: item.postingId,
        amountCents: item.remainingCents,
      })),
    )
    const pixPayload =
      settings.pixReceivingKey && settings.pixReceiverName && settings.pixReceiverCity
        ? pixCopiaECola({
            key: settings.pixReceivingKey,
            receiverName: settings.pixReceiverName,
            receiverCity: settings.pixReceiverCity,
            amountCents: totalCents,
            txid: chargeId,
          })
        : null
    const messageText = chargeMessage({
      contactName: contact.name,
      requesterName: requester.displayName,
      items,
      totalCents,
      dueOn,
      pixPayload,
    })
    await updateCharge(tx, chargeId, { messageText, pixPayload })
    await auditCreation(tx, chargeAuditTarget(workspaceId, chargeId))
    return { chargeId }
  })
}

export function listCharges(
  db: Database,
  workspaceId: string,
  contactId?: string,
): Promise<ChargeView[]> {
  return withWorkspace(db, workspaceId, async (tx) =>
    viewsOf(tx, await selectCharges(tx, contactId)),
  )
}

export function getCharge(
  db: Database,
  workspaceId: string,
  chargeId: string,
): Promise<ChargeView> {
  return withWorkspace(db, workspaceId, async (tx) => {
    const charge = await selectCharge(tx, chargeId)
    const [view] = charge ? await viewsOf(tx, [charge]) : []
    if (!view) {
      throw chargeNotFound(chargeId)
    }
    return view
  })
}

export async function markChargeSent(
  db: Database,
  ref: ChargeRef,
  clock: Clock = systemClock,
): Promise<void> {
  await moveCharge(db, ref, ['draft'], { status: 'sent', sentAt: clock.now() })
}

export async function cancelCharge(db: Database, ref: ChargeRef): Promise<void> {
  await moveCharge(db, ref, OPEN_CHARGE_STATUSES, { status: 'cancelled' })
}

export async function payCharge(
  db: Database,
  { workspaceId, chargeId }: ChargeRef,
  userId: string,
  rawInput: unknown,
  clock: Clock = systemClock,
): Promise<RecordedPayment> {
  const payment = parseOrThrow(chargePaymentSchema, rawInput, 'CHARGE_PAYMENT_INVALID')
  return withWorkspace(db, workspaceId, async (tx) => {
    const charge = await lockExistingCharge(tx, chargeId)
    if (charge.status === 'cancelled') {
      throw new ConflictError('CHARGE_STATUS_REFUSED', `Charge ${chargeId} is cancelled`)
    }
    const entryId = await recordEntryInTransaction(
      tx,
      { workspaceId, userId, source: 'web' },
      {
        entryType: 'settlement',
        occurredOn: payment.occurredOn,
        description: SETTLEMENT_DESCRIPTION,
        amountCents: payment.amountCents,
        contactId: charge.contactId,
        receivedInAccountId: payment.receivedInAccountId,
      },
      clock,
    )
    const paymentId = await insertChargePayment(tx, {
      workspaceId,
      chargeId,
      entryId,
      amountCents: payment.amountCents,
    })
    await auditCreation(tx, chargePaymentAuditTarget(workspaceId, paymentId))
    return { entryId }
  })
}

async function moveCharge(
  db: Database,
  { workspaceId, chargeId }: ChargeRef,
  from: readonly ChargeStatus[],
  update: { status: ChargeStatus; sentAt?: Date },
): Promise<void> {
  await withWorkspace(db, workspaceId, async (tx) => {
    const charge = await lockExistingCharge(tx, chargeId)
    const paidCents = (await paidByCharge(tx, [chargeId])).get(chargeId) ?? 0
    if (!from.includes(charge.status) || paidCents > 0) {
      throw new ConflictError('CHARGE_STATUS_REFUSED', `Charge ${chargeId} is ${charge.status}`)
    }
    await audited(tx, chargeAuditTarget(workspaceId, chargeId), 'update', () =>
      updateCharge(tx, chargeId, update),
    )
  })
}

export function chargeExists(tx: WorkspaceTransaction, chargeId: string): Promise<boolean> {
  return selectChargeExists(tx, chargeId)
}

async function lockExistingCharge(tx: WorkspaceTransaction, chargeId: string): Promise<ChargeRow> {
  const charge = await lockCharge(tx, chargeId)
  if (!charge) {
    throw chargeNotFound(chargeId)
  }
  return charge
}

function chargeNotFound(chargeId: string): NotFoundError {
  return new NotFoundError('CHARGE_NOT_FOUND', `Charge ${chargeId} not found`)
}

async function paidByCharge(
  tx: WorkspaceTransaction,
  chargeIds: string[],
): Promise<ReadonlyMap<string, number>> {
  const payments = await selectChargePayments(tx, chargeIds)
  const active = await activeEntryIdsOf(
    tx,
    payments.map((payment) => payment.entryId),
  )
  const paid = new Map<string, number>()
  for (const payment of payments.filter((candidate) => active.has(candidate.entryId))) {
    paid.set(payment.chargeId, (paid.get(payment.chargeId) ?? 0) + payment.amountCents)
  }
  return paid
}

async function chargeableItemsOf(
  tx: WorkspaceTransaction,
  contactId: string,
  until: IsoDate,
): Promise<OpenItem[]> {
  const { items, paidCents } = await readContactItems(tx, contactId)
  const alreadyCharged = new Set(await selectPostingsInOpenCharges(tx, contactId))
  return openItems(items, paidCents, { until, alreadyCharged })
}

async function viewsOf(tx: WorkspaceTransaction, rows: ChargeRow[]): Promise<ChargeView[]> {
  if (rows.length === 0) {
    return []
  }
  const chargeIds = rows.map((row) => row.id)
  const items = await selectChargeItems(tx, chargeIds)
  const paid = await paidByCharge(tx, chargeIds)
  return rows.map((row) => ({
    id: row.id,
    contactId: row.contactId,
    amountCents: row.amountCents,
    dueOn: row.dueOn,
    status: chargeStatusOf(row.status, row.amountCents, paid.get(row.id) ?? 0),
    paidCents: paid.get(row.id) ?? 0,
    messageText: row.messageText,
    pixPayload: row.pixPayload,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    items: items
      .filter((item) => item.chargeId === row.id)
      .map(({ postingId, amountCents }) => ({ postingId, amountCents })),
  }))
}
