import { daysBetween } from '@shared/calendar/dates'
import { isInPeriod } from '@shared/calendar/period'
import type { AccountClass, IncomeNature } from '@shared/ledger/ledger.constants'
import type {
  FactAccount,
  FactOccurrence,
  FactPosting,
  PeriodDays,
  PeriodFacts,
} from '@shared/metrics/metrics.types'
import type { RecurringEntryType } from '@shared/recurrence/recurrence.constants'

export function postingsCounted(facts: PeriodFacts, accountClass: AccountClass): FactPosting[] {
  const accounts = accountsById(facts)
  const countedOn = (posting: FactPosting) =>
    facts.installmentBudgetView === 'purchase_month' ? posting.occurredOn : posting.effectiveOn
  return facts.postings.filter(
    (posting) =>
      accounts.get(posting.accountId)?.class === accountClass &&
      isInPeriod(countedOn(posting), facts.period),
  )
}

export function pendingInPeriod(
  facts: PeriodFacts,
  entryTypes: readonly RecurringEntryType[],
): FactOccurrence[] {
  return facts.occurrences.filter(
    (occurrence) =>
      occurrence.status === 'pending' &&
      entryTypes.includes(occurrence.entryType) &&
      isInPeriod(occurrence.dueOn, facts.period),
  )
}

export function incomeNatureOf(facts: PeriodFacts, accountId: string): IncomeNature | null {
  return accountsById(facts).get(accountId)?.incomeNature ?? null
}

export function accountWithDescendants(facts: PeriodFacts, accountId: string): ReadonlySet<string> {
  const covered = new Set([accountId])
  let grew = true
  while (grew) {
    const before = covered.size
    for (const account of facts.accounts) {
      if (account.parentId && covered.has(account.parentId)) {
        covered.add(account.id)
      }
    }
    grew = covered.size > before
  }
  return covered
}

export function periodDays({ today, period }: PeriodFacts): PeriodDays {
  const total = daysBetween(period.start, period.end) + 1
  if (today < period.start) {
    return { total, elapsed: 0, left: total }
  }
  if (today > period.end) {
    return { total, elapsed: total, left: 0 }
  }
  const elapsed = daysBetween(period.start, today) + 1
  return { total, elapsed, left: total - elapsed + 1 }
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function accountsById(facts: PeriodFacts): ReadonlyMap<string, FactAccount> {
  return new Map(facts.accounts.map((account) => [account.id, account]))
}
