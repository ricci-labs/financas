import type { IsoDate } from '@shared/calendar/calendar.types'

export type ChargeableItem = {
  postingId: string
  description: string
  installmentNo: number | null
  installmentCount: number
  effectiveOn: IsoDate
  amountCents: number
}

export type OpenItem = ChargeableItem & {
  remainingCents: number
}

export type ChargeMessageInput = {
  contactName: string
  requesterName: string
  items: readonly OpenItem[]
  totalCents: number
  dueOn: IsoDate | null
  pixPayload: string | null
}
