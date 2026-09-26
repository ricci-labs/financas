import { isInPeriod } from '@shared/calendar/period'
import type { AccountClass, IncomeNature } from '@shared/ledger/ledger.constants'
import type {
  FactAccount,
  FactOccurrence,
  FactPosting,
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

export function sumCents(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function accountsById(facts: PeriodFacts): ReadonlyMap<string, FactAccount> {
  return new Map(facts.accounts.map((account) => [account.id, account]))
}
