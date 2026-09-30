import type { Cents } from '@shared/core/money/money.types'

export type ProportionalShare = {
  party: number
  cents: Cents
  remainder: bigint
}
