import {
  addMonths,
  clampedDate,
  type IsoDate,
  parseIsoDate,
  toYearMonthLabel,
  type YearMonth,
} from '@shared/domain/dates'

export type CardCycle = {
  closingDay: number
  dueDay: number
  purchaseOnClosingDayGoesNext: boolean
}

export type InvoiceRef = {
  closingOn: IsoDate
  dueOn: IsoDate
  referenceMonth: string
}

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
