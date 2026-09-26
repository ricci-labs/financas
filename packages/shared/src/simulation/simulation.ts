import { invoicesForInstallments } from '@shared/cards/billing-cycle'
import { computeInsights } from '@shared/insights/insights'
import type { Insight } from '@shared/insights/insights.types'
import { splitInstallments } from '@shared/installments/installments'
import { sumCents } from '@shared/metrics/facts'
import { computeMetrics } from '@shared/metrics/metrics'
import type { FactCard, FactInvoice, FactPosting, PeriodFacts } from '@shared/metrics/metrics.types'
import type { PurchaseImpact, SimulatedPurchase } from '@shared/simulation/simulation.types'

export const SIMULATED_CATEGORY_ID = 'simulated-purchase'

export function simulatePurchase(facts: PeriodFacts, purchase: SimulatedPurchase): PurchaseImpact {
  const after = withPurchase(facts, purchase)
  const metricsBefore = computeMetrics(facts)
  const metricsAfter = computeMetrics(after)
  return {
    period: {
      label: facts.period.label,
      freeToSpendBefore: metricsBefore.freeToSpend,
      freeToSpendAfter: metricsAfter.freeToSpend,
      dailyAllowanceBefore: metricsBefore.dailyAllowance,
      dailyAllowanceAfter: metricsAfter.dailyAllowance,
    },
    coming: metricsAfter.committedAhead.map((period, index) => ({
      label: period.label,
      committedBefore: metricsBefore.committedAhead[index]?.committedCents ?? 0,
      committedAfter: period.committedCents,
      percentOfIncomeBefore: metricsBefore.committedAhead[index]?.percentOfIncome ?? null,
      percentOfIncomeAfter: period.percentOfIncome,
    })),
    newInsights: newOnly(
      computeInsights(facts, metricsBefore),
      computeInsights(after, metricsAfter),
    ),
  }
}

export function withPurchase(facts: PeriodFacts, purchase: SimulatedPurchase): PeriodFacts {
  const withCategory = {
    ...facts,
    accounts: [
      ...facts.accounts,
      {
        id: SIMULATED_CATEGORY_ID,
        parentId: null,
        kind: 'expense_category' as const,
        class: 'expense' as const,
        incomeNature: null,
      },
    ],
  }
  return purchase.card
    ? onCard(withCategory, purchase, purchase.card)
    : fromAccount(withCategory, purchase, purchase.paidFromAccountId ?? '')
}

function onCard(facts: PeriodFacts, purchase: SimulatedPurchase, card: FactCard): PeriodFacts {
  const invoices = invoicesForInstallments(purchase.occurredOn, card, purchase.installmentCount)
  const amounts = splitInstallments(purchase.amountCents, purchase.installmentCount)
  const installments = invoices.map((invoice, index) => ({
    invoice,
    amountCents: amounts[index] ?? 0,
  }))
  const postings: FactPosting[] = installments.map(({ invoice, amountCents }) => ({
    accountId: SIMULATED_CATEGORY_ID,
    amountCents,
    effectiveOn: invoice.dueOn,
    occurredOn: purchase.occurredOn,
  }))
  const addedTo = (closingOn: string) =>
    sumCents(
      installments
        .filter(({ invoice }) => invoice.closingOn === closingOn)
        .map(({ amountCents }) => amountCents),
    )
  const isOfCard = (invoice: FactInvoice) => invoice.cardAccountId === card.accountId
  const updated = facts.invoices.map((invoice) =>
    isOfCard(invoice)
      ? { ...invoice, totalCents: invoice.totalCents + addedTo(invoice.closingOn) }
      : invoice,
  )
  const known = new Set(facts.invoices.filter(isOfCard).map((invoice) => invoice.closingOn))
  const created = installments
    .filter(({ invoice }) => !known.has(invoice.closingOn))
    .map(({ invoice, amountCents }) => ({
      cardAccountId: card.accountId,
      closingOn: invoice.closingOn,
      dueOn: invoice.dueOn,
      totalCents: amountCents,
      paidCents: 0,
    }))
  const updatedInvoices = [...updated, ...created]
  return { ...facts, postings: [...facts.postings, ...postings], invoices: updatedInvoices }
}

function fromAccount(
  facts: PeriodFacts,
  purchase: SimulatedPurchase,
  accountId: string,
): PeriodFacts {
  const expense = {
    accountId: SIMULATED_CATEGORY_ID,
    amountCents: purchase.amountCents,
    effectiveOn: purchase.occurredOn,
    occurredOn: purchase.occurredOn,
  }
  const payment = { ...expense, accountId, amountCents: -purchase.amountCents }
  const balances = facts.balances.map((balance) =>
    balance.accountId === accountId
      ? { ...balance, balanceCents: balance.balanceCents - purchase.amountCents }
      : balance,
  )
  const later = purchase.occurredOn > facts.today ? [payment] : []
  return { ...facts, postings: [...facts.postings, expense, ...later], balances }
}

function newOnly(before: readonly Insight[], after: readonly Insight[]): Insight[] {
  const keyOf = (insight: Insight) => `${insight.code}:${insight.subject}`
  const existing = new Set(before.map(keyOf))
  return after.filter((insight) => !existing.has(keyOf(insight)))
}
