export const INSIGHT_SEVERITIES = ['alert', 'warning', 'info'] as const

export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number]

export const INSIGHT_CODES = [
  'period_overspent',
  'budget_over',
  'budget_ahead',
  'occurrence_overdue',
  'period_heavily_committed',
  'variable_income_to_split',
] as const

export type InsightCode = (typeof INSIGHT_CODES)[number]

export const HEAVILY_COMMITTED_PERCENT = 70
