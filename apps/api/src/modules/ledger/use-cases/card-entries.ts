import type { WorkspaceTransaction } from '@api/core/db/tx'
import { ValidationError } from '@api/core/http/errors'
import {
  findCardCycle,
  findInvoiceOfCard,
  insertInvoicesIfMissing,
  selectInvoicesNotClosed,
  selectInvoicesOfMonths,
  setInvoiceStatus,
} from '@api/modules/ledger/ledger.repository'
import type { WorkspaceCard } from '@api/modules/ledger/ledger.types'
import { loadAccounts, pick } from '@api/modules/ledger/use-cases/lookups'
import {
  type AccountRef,
  type CardCycle,
  type EntryInput,
  type EntryPlan,
  type InstallmentTarget,
  type InvoiceRef,
  type IsoDate,
  invoiceStatusOn,
  invoicesForInstallments,
} from '@financas/shared'

type CardPurchaseInput = Extract<EntryInput, { entryType: 'card_purchase' }>

type InvoicePaymentInput = Extract<EntryInput, { entryType: 'invoice_payment' }>

type CardSetup = CardCycle & {
  paymentAccountId: string | null
}

const FIRST_DAY_SUFFIX = '-01'

export async function planCardPurchase(
  tx: WorkspaceTransaction,
  workspaceId: string,
  input: CardPurchaseInput,
  today: IsoDate,
): Promise<EntryPlan> {
  const accounts = await loadAccounts(tx, [input.cardAccountId, input.categoryId])
  const card = pick(accounts, input.cardAccountId)
  const setup = await cardSetupOf(tx, card)
  await refreshInvoiceStatuses(tx, card.id, setup, today)
  return {
    entryType: 'card_purchase',
    occurredOn: input.occurredOn,
    amountCents: input.amountCents,
    card,
    category: pick(accounts, input.categoryId),
    installments: await installmentTargets(
      tx,
      { workspaceId, cardAccountId: card.id },
      setup,
      input,
      today,
    ),
  }
}

export async function planInvoicePayment(
  tx: WorkspaceTransaction,
  input: InvoicePaymentInput,
  today: IsoDate,
): Promise<EntryPlan> {
  const card = pick(await loadAccounts(tx, [input.cardAccountId]), input.cardAccountId)
  const setup = await cardSetupOf(tx, card)
  await refreshInvoiceStatuses(tx, card.id, setup, today)

  const invoice = await findInvoiceOfCard(tx, input.invoiceId, card.id)
  if (!invoice) {
    throw new ValidationError('INVOICE_NOT_FOUND', `Invoice ${input.invoiceId} is not of this card`)
  }
  const paidFromId = input.paidFromAccountId ?? setup.paymentAccountId
  if (!paidFromId) {
    throw new ValidationError('PAYMENT_ACCOUNT_REQUIRED', 'Tell which account pays the invoice')
  }
  return {
    entryType: 'invoice_payment',
    occurredOn: input.occurredOn,
    amountCents: input.amountCents,
    card,
    invoiceId: invoice.id,
    paidFrom: pick(await loadAccounts(tx, [paidFromId]), paidFromId),
  }
}

async function cardSetupOf(tx: WorkspaceTransaction, card: AccountRef): Promise<CardSetup> {
  if (card.kind !== 'credit_card') {
    throw new ValidationError('NOT_A_CARD', `Account ${card.id} is not a credit card`)
  }
  const setup = await findCardCycle(tx, card.id)
  if (!setup) {
    throw new ValidationError('CARD_NOT_SET_UP', `Card ${card.id} has no closing and due days`)
  }
  return setup
}

async function refreshInvoiceStatuses(
  tx: WorkspaceTransaction,
  cardAccountId: string,
  cycle: CardCycle,
  today: IsoDate,
) {
  for (const invoice of await selectInvoicesNotClosed(tx, cardAccountId)) {
    const status = invoiceStatusOn(
      { closingOn: invoice.closingOn, referenceMonth: monthLabelOf(invoice.referenceMonth) },
      today,
      cycle,
    )
    if (status !== invoice.status) {
      await setInvoiceStatus(tx, invoice.id, status)
    }
  }
}

async function installmentTargets(
  tx: WorkspaceTransaction,
  { workspaceId, cardAccountId }: WorkspaceCard,
  cycle: CardCycle,
  input: CardPurchaseInput,
  today: IsoDate,
): Promise<InstallmentTarget[]> {
  const refs = invoicesForInstallments(input.occurredOn, cycle, input.installmentCount)
  await insertInvoicesIfMissing(
    tx,
    refs.map((ref) => ({
      workspaceId,
      cardAccountId,
      referenceMonth: firstDayOf(ref),
      closingOn: ref.closingOn,
      dueOn: ref.dueOn,
      status: invoiceStatusOn(ref, today, cycle),
    })),
  )
  const stored = await selectInvoicesOfMonths(tx, cardAccountId, refs.map(firstDayOf))
  const byMonth = new Map(stored.map((invoice) => [invoice.referenceMonth, invoice]))

  return refs.map((ref) => {
    const invoice = byMonth.get(firstDayOf(ref))
    if (!invoice) {
      throw new Error(`Invoice ${ref.referenceMonth} of card ${cardAccountId} is missing`)
    }
    if (invoice.status === 'closed') {
      throw new ValidationError('INVOICE_CLOSED', `The ${ref.referenceMonth} invoice is closed`)
    }
    return { invoiceId: invoice.id, effectiveOn: invoice.dueOn }
  })
}

function firstDayOf(ref: InvoiceRef): string {
  return `${ref.referenceMonth}${FIRST_DAY_SUFFIX}`
}

function monthLabelOf(referenceMonth: string): string {
  return referenceMonth.slice(0, -FIRST_DAY_SUFFIX.length)
}
