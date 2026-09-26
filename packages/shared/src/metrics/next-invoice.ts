import { invoiceForPurchase } from '@shared/cards/billing-cycle'
import { sumCents } from '@shared/metrics/facts'
import type { FactCard, InvoiceForecast, PeriodFacts } from '@shared/metrics/metrics.types'

export function nextInvoice(facts: PeriodFacts): InvoiceForecast[] {
  return facts.cards.map((card) => forecastOf(facts, card))
}

function forecastOf(facts: PeriodFacts, card: FactCard): InvoiceForecast {
  const { closingOn, dueOn } = invoiceForPurchase(facts.today, card)
  const postedCents =
    facts.invoices.find(
      (invoice) => invoice.cardAccountId === card.accountId && invoice.closingOn === closingOn,
    )?.totalCents ?? 0
  const plannedCents = sumCents(
    facts.occurrences
      .filter(
        (occurrence) =>
          occurrence.status === 'pending' &&
          occurrence.entryType === 'card_purchase' &&
          occurrence.sourceAccountId === card.accountId &&
          invoiceForPurchase(occurrence.dueOn, card).closingOn === closingOn,
      )
      .map((occurrence) => occurrence.amountCents),
  )
  return {
    cardAccountId: card.accountId,
    closingOn,
    dueOn,
    postedCents,
    plannedCents,
    forecastCents: postedCents + plannedCents,
  }
}
