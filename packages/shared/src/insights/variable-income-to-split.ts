import { isInPeriod } from '@shared/calendar/period'
import type { InsightRule } from '@shared/insights/insights.types'
import { sumCents } from '@shared/metrics/facts'

export const variableIncomeToSplit: InsightRule = (facts, { variableIncome, freeToSpend }) => {
  if (!facts.allocation) {
    return []
  }
  const destinations = new Set(facts.allocation.destinationAccountIds)
  const moved = sumCents(
    facts.postings
      .filter(
        (posting) =>
          destinations.has(posting.accountId) &&
          posting.amountCents > 0 &&
          isInPeriod(posting.effectiveOn, facts.period),
      )
      .map((posting) => posting.amountCents),
  )
  const covered = facts.allocation.coversOverspent ? Math.max(-freeToSpend, 0) : 0
  const toSplit = variableIncome - moved - covered
  return toSplit > 0
    ? [
        {
          code: 'variable_income_to_split',
          severity: 'info',
          subject: facts.period.label,
          values: { amountCents: toSplit },
        },
      ]
    : []
}
