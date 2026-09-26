import type { Cents } from '@shared/money/money.types'

export type ProportionalShare = {
  party: number
  cents: Cents
  remainder: bigint
}
