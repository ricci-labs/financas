import type { IsoDate } from '@shared/calendar/calendar.types'

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
