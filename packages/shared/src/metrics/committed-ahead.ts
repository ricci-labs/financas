import { committed } from '@shared/metrics/committed'
import { postingsEffectiveIn, sumCents } from '@shared/metrics/facts'
import { fixedIncome } from '@shared/metrics/fixed-income'
import type { CommittedPeriod, PeriodFacts } from '@shared/metrics/metrics.types'

const PERCENT = 100

export function committedAhead(facts: PeriodFacts): CommittedPeriod[] {
  return facts.upcomingPeriods.map((period) => {
    const thatPeriod = { ...facts, period }
    const installmentsCents = sumCents(
      postingsEffectiveIn(facts, 'expense', period).map((posting) => posting.amountCents),
    )
    const plannedCents = committed(thatPeriod)
    const committedCents = installmentsCents + plannedCents
    const fixedIncomeCents = fixedIncome(thatPeriod)
    return {
      label: period.label,
      installmentsCents,
      plannedCents,
      committedCents,
      fixedIncomeCents,
      percentOfIncome:
        fixedIncomeCents > 0 ? Math.round((committedCents * PERCENT) / fixedIncomeCents) : null,
    }
  })
}
