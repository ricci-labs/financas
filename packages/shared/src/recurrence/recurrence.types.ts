import type { WeekendRule } from '@shared/calendar/calendar.constants'
import type { IsoDate } from '@shared/calendar/calendar.types'
import type { AccountKind, EntryType } from '@shared/ledger/ledger.constants'
import type {
  RecurrenceFrequency,
  RecurringEntryType,
} from '@shared/recurrence/recurrence.constants'

export type RecurrenceSchedule = {
  frequency: RecurrenceFrequency
  interval: number
  dayOfMonth: number | null
  nthBusinessDay: number | null
  weekendRule: WeekendRule
  startsOn: IsoDate
  endsOn: IsoDate | null
}

export type DateRange = {
  from: IsoDate
  to: IsoDate
}

export type RecurringAccountKinds = {
  source: (kind: AccountKind) => boolean
  category: (kind: AccountKind) => boolean
}

export type MatchableEntry = {
  entryType: EntryType
  occurredOn: IsoDate
  postings: ReadonlyArray<{ accountId: string; amountCents: number }>
}

export type MatchableOccurrence = {
  dueOn: IsoDate
  amountCents: number
  amountIsEstimate: boolean
  entryType: RecurringEntryType
  sourceAccountId: string
  categoryAccountId: string
  frequency: RecurrenceFrequency
  interval: number
}
