export const ALLOCATION_STEP_KINDS = [
  'fill_goal',
  'cover_overspent',
  'percent',
  'fixed_amount',
  'rest',
] as const

export type AllocationStepKind = (typeof ALLOCATION_STEP_KINDS)[number]

export const MAX_ALLOCATION_STEPS = 10

export const MAX_ALLOCATION_PERCENT = 100
