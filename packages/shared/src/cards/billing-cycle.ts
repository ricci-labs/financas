import type { IsoDate, YearMonth } from '@shared/calendar/calendar.types'
import { addMonths, clampedDate, parseIsoDate, toYearMonthLabel } from '@shared/calendar/dates'
import type { CardCycle, InvoiceRef } from '@shared/cards/cards.types'
import type { InvoiceStatus } from '@shared/ledger/ledger.constants'

export function invoiceForPurchase(purchaseDate: IsoDate, card: CardCycle): InvoiceRef {
  assertDayOfMonth(card.closingDay, 'closingDay')
  assertDayOfMonth(card.dueDay, 'dueDay')

  const { year, month } = parseIsoDate(purchaseDate)
  const purchaseMonth = { year, month }
  const closingInPurchaseMonth = clampedDate(purchaseMonth, card.closingDay)

  const isAfterClosing = purchaseDate > closingInPurchaseMonth
  const isOnClosingDay = purchaseDate === closingInPurchaseMonth
  const goesToNextInvoice = isAfterClosing || (isOnClosingDay && card.purchaseOnClosingDayGoesNext)

  const closingMonth = goesToNextInvoice ? addMonths(purchaseMonth, 1) : purchaseMonth
  return invoiceClosingIn(closingMonth, card)
}

export function invoicesForInstallments(
  purchaseDate: IsoDate,
  card: CardCycle,
  count: number,
): InvoiceRef[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`Installment count must be a positive integer: ${count}`)
  }

  const firstInvoice = invoiceForPurchase(purchaseDate, card)
  const { year, month } = parseIsoDate(firstInvoice.closingOn)
  const firstClosingMonth = { year, month }

  return Array.from({ length: count }, (_, offset) =>
    invoiceClosingIn(addMonths(firstClosingMonth, offset), card),
  )
}

function invoiceClosingIn(closingMonth: YearMonth, card: CardCycle): InvoiceRef {
  const dueFallsInSameMonth = card.dueDay > card.closingDay
  const dueMonth = dueFallsInSameMonth ? closingMonth : addMonths(closingMonth, 1)

  return {
    closingOn: clampedDate(closingMonth, card.closingDay),
    dueOn: clampedDate(dueMonth, card.dueDay),
    referenceMonth: toYearMonthLabel(dueMonth),
  }
}

function assertDayOfMonth(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new RangeError(`${label} must be between 1 and 31: ${value}`)
  }
}

export function invoiceStatusOn(
  invoice: Pick<InvoiceRef, 'closingOn' | 'referenceMonth'>,
  today: IsoDate,
  card: CardCycle,
): InvoiceStatus {
  const closesToday = invoice.closingOn === today
  const hasClosed = invoice.closingOn < today || (closesToday && card.purchaseOnClosingDayGoesNext)
  if (hasClosed) {
    return 'closed'
  }
  const openReferenceMonth = invoiceForPurchase(today, card).referenceMonth
  return invoice.referenceMonth <= openReferenceMonth ? 'open' : 'future'
}
