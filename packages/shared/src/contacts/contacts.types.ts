import type { IsoDate } from '@shared/calendar/calendar.types'

export type ContactPosting = {
  contactId: string
  amountCents: number
  effectiveOn: IsoDate
}

export type ContactBalance = {
  contactId: string
  owedCents: number
  overdueCents: number
  nextDueOn: IsoDate | null
  nextDueCents: number
}
