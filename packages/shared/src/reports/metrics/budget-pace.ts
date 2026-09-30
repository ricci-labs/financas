import {
  accountWithDescendants,
  periodDays,
  postingsCounted,
  sumCents,
} from '@shared/reports/metrics/facts'
import type { BudgetPace, PeriodFacts } from '@shared/reports/metrics/metrics.types'

export function budgetPace(facts: PeriodFacts): BudgetPace[] {
  const expenses = postingsCounted(facts, 'expense')
  const { total, elapsed } = periodDays(facts)
  return facts.budgets.map(({ categoryAccountId, limitCents }) => {
    const covered = accountWithDescendants(facts, categoryAccountId)
    const spentCents = sumCents(
      expenses
        .filter((posting) => covered.has(posting.accountId))
        .map((posting) => posting.amountCents),
    )
    const expectedCents = Math.round((limitCents * elapsed) / total)
    return {
      categoryAccountId,
      limitCents,
      spentCents,
      expectedCents,
      status: statusOf(spentCents, limitCents, expectedCents),
    }
  })
}

function statusOf(
  spentCents: number,
  limitCents: number,
  expectedCents: number,
): BudgetPace['status'] {
  if (spentCents > limitCents) {
    return 'over'
  }
  return spentCents > expectedCents ? 'ahead' : 'within'
}
