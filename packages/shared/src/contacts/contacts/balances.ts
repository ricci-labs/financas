import type { ContactBalance, ContactPosting } from '@shared/contacts/contacts/contacts.types'
import type { IsoDate } from '@shared/core/calendar/calendar.types'

export function contactBalances(
  postings: readonly ContactPosting[],
  today: IsoDate,
): ContactBalance[] {
  const contactIds = [...new Set(postings.map((posting) => posting.contactId))]
  return contactIds.map((contactId) =>
    balanceOf(
      contactId,
      postings.filter((posting) => posting.contactId === contactId),
      today,
    ),
  )
}

function balanceOf(
  contactId: string,
  postings: readonly ContactPosting[],
  today: IsoDate,
): ContactBalance {
  const charged = postings.filter((posting) => posting.amountCents > 0)
  const paidCents = -sum(postings.filter((posting) => posting.amountCents < 0))
  const dueByToday = sum(charged.filter((posting) => posting.effectiveOn <= today))
  const upcoming = charged.filter((posting) => posting.effectiveOn > today)
  const nextDueOn = upcoming.map((posting) => posting.effectiveOn).sort()[0] ?? null
  return {
    contactId,
    owedCents: sum(postings),
    overdueCents: Math.max(dueByToday - paidCents, 0),
    nextDueOn,
    nextDueCents: sum(upcoming.filter((posting) => posting.effectiveOn === nextDueOn)),
  }
}

function sum(postings: readonly ContactPosting[]): number {
  return postings.reduce((total, posting) => total + posting.amountCents, 0)
}
