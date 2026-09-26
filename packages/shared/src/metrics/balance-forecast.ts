import type { IsoDate } from '@shared/calendar/calendar.types'
import { invoiceForPurchase } from '@shared/cards/billing-cycle'
import { type AccountKind, MONEY_ACCOUNT_KINDS } from '@shared/ledger/ledger.constants'
import { incomeNatureOf, sumCents } from '@shared/metrics/facts'
import type {
  BalanceForecast,
  BalanceMove,
  FactAccount,
  FactOccurrence,
  PeriodFacts,
} from '@shared/metrics/metrics.types'

const MONEY_KINDS: ReadonlySet<AccountKind> = new Set(MONEY_ACCOUNT_KINDS)

export function balanceForecast(facts: PeriodFacts): BalanceForecast[] {
  return facts.accounts
    .filter((account) => MONEY_KINDS.has(account.kind))
    .map((account) => forecastOf(facts, account))
}

function forecastOf(facts: PeriodFacts, account: FactAccount): BalanceForecast {
  const until = horizonOf(facts, account.id)
  const moves = [
    ...plannedMoves(facts, account.id),
    ...invoicePayments(facts, account.id),
    ...futurePostings(facts, account.id),
  ]
    .filter((move) => move.on <= until)
    .sort((left, right) => left.on.localeCompare(right.on))
  const startCents = balanceToday(facts, account.id)
  let balanceCents = startCents
  let lowest = { on: facts.today, balanceCents: startCents }
  const points = [{ on: facts.today, balanceCents }]
  for (const move of moves) {
    balanceCents += move.amountCents
    const last = points.at(-1)
    if (last && last.on === move.on) {
      last.balanceCents = balanceCents
    } else {
      points.push({ on: move.on, balanceCents })
    }
    if (balanceCents < lowest.balanceCents) {
      lowest = { on: move.on, balanceCents }
    }
  }
  return {
    accountId: account.id,
    until,
    startCents,
    endCents: balanceCents,
    lowestCents: lowest.balanceCents,
    lowestOn: lowest.on,
    points,
  }
}

function horizonOf(facts: PeriodFacts, accountId: string): IsoDate {
  const nextSalary = facts.occurrences
    .filter(
      (occurrence) =>
        occurrence.status === 'pending' &&
        occurrence.entryType === 'income' &&
        occurrence.sourceAccountId === accountId &&
        occurrence.dueOn >= facts.today &&
        incomeNatureOf(facts, occurrence.categoryAccountId) === 'fixed',
    )
    .map((occurrence) => occurrence.dueOn)
    .sort()[0]
  return nextSalary && nextSalary > facts.period.end ? nextSalary : facts.period.end
}

function balanceToday(facts: PeriodFacts, accountId: string): number {
  const balance =
    facts.balances.find((candidate) => candidate.accountId === accountId)?.balanceCents ?? 0
  const later = futurePostings(facts, accountId).map((move) => move.amountCents)
  return balance - sumCents(later)
}

function plannedMoves(facts: PeriodFacts, accountId: string): BalanceMove[] {
  return facts.occurrences
    .filter((occurrence) => occurrence.status === 'pending' && !isVariableIncome(facts, occurrence))
    .map((occurrence) => ({
      on: occurrence.dueOn < facts.today ? facts.today : occurrence.dueOn,
      amountCents: effectOn(accountId, occurrence),
    }))
    .filter((move) => move.amountCents !== 0)
}

function isVariableIncome(facts: PeriodFacts, occurrence: FactOccurrence): boolean {
  return (
    occurrence.entryType === 'income' &&
    incomeNatureOf(facts, occurrence.categoryAccountId) === 'variable'
  )
}

function effectOn(accountId: string, occurrence: FactOccurrence): number {
  const leaves = occurrence.sourceAccountId === accountId ? occurrence.amountCents : 0
  const arrives = occurrence.categoryAccountId === accountId ? occurrence.amountCents : 0
  switch (occurrence.entryType) {
    case 'income':
      return leaves
    case 'expense':
      return -leaves
    case 'transfer':
      return arrives - leaves
    case 'card_purchase':
      return 0
  }
}

function invoicePayments(facts: PeriodFacts, accountId: string): BalanceMove[] {
  return facts.cards
    .filter((card) => card.paymentAccountId === accountId)
    .flatMap((card) => {
      const open = invoiceForPurchase(facts.today, card)
      const subscriptions = sumCents(
        facts.occurrences
          .filter(
            (occurrence) =>
              occurrence.status === 'pending' &&
              occurrence.entryType === 'card_purchase' &&
              occurrence.sourceAccountId === card.accountId &&
              invoiceForPurchase(occurrence.dueOn, card).closingOn === open.closingOn,
          )
          .map((occurrence) => occurrence.amountCents),
      )
      const invoices = facts.invoices.filter(
        (invoice) => invoice.cardAccountId === card.accountId && invoice.dueOn >= facts.today,
      )
      const openIsListed = invoices.some((invoice) => invoice.closingOn === open.closingOn)
      const payments = invoices.map((invoice) => ({
        on: invoice.dueOn,
        amountCents: -(
          invoice.totalCents -
          invoice.paidCents +
          (invoice.closingOn === open.closingOn ? subscriptions : 0)
        ),
      }))
      return openIsListed || subscriptions === 0
        ? payments
        : [...payments, { on: open.dueOn, amountCents: -subscriptions }]
    })
    .filter((move) => move.amountCents !== 0)
}

function futurePostings(facts: PeriodFacts, accountId: string): BalanceMove[] {
  return facts.postings
    .filter((posting) => posting.accountId === accountId && posting.effectiveOn > facts.today)
    .map((posting) => ({ on: posting.effectiveOn, amountCents: posting.amountCents }))
}
