import type { InsightRule } from '@shared/reports/insights/insights.types'

export const balanceGoingNegative: InsightRule = (_facts, { balanceForecast }) =>
  balanceForecast
    .filter((forecast) => forecast.lowestCents < 0)
    .map((forecast) => ({
      code: 'balance_going_negative',
      severity: 'alert',
      subject: forecast.accountId,
      values: { lowestCents: forecast.lowestCents, lowestOn: forecast.lowestOn },
    }))
