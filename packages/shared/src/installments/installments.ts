import type { ProportionalShare } from '@shared/installments/installments.types'
import { assertPositiveCents, sumCents } from '@shared/money/money'
import type { Cents } from '@shared/money/money.types'

export function splitInstallments(total: Cents, count: number): Cents[] {
  assertPositiveCents(total, 'total')
  assertInstallmentCount(count)
  if (count > total) {
    throw new RangeError(`Cannot split ${total} cents into ${count} installments`)
  }

  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base))
}

export function allocateAcrossInstallments(
  installments: readonly Cents[],
  partyTotals: readonly Cents[],
): Cents[][] {
  assertAllocationInput(installments, partyTotals)

  const total = sumCents(installments)
  const allocatedSoFar = partyTotals.map(() => 0)
  const lastRow = installments.length - 1

  return installments.map((installment, row) => {
    const cells =
      row === lastRow
        ? remainingPerParty(partyTotals, allocatedSoFar)
        : proportionalRow(installment, partyTotals, total)

    assertNoNegativeShare(cells)
    cells.forEach((cell, party) => {
      allocatedSoFar[party] = (allocatedSoFar[party] ?? 0) + cell
    })
    return cells
  })
}

function proportionalRow(installment: Cents, partyTotals: readonly Cents[], total: Cents): Cents[] {
  const shares = partyTotals.map((partyTotal, party) =>
    proportionalShare(installment, partyTotal, total, party),
  )
  const cells = shares.map((share) => share.cents)
  const leftoverCents = installment - sumCents(cells)

  const partiesByLargestRemainder = [...shares].sort(byLargestRemainderThenParty)
  for (let index = 0; index < leftoverCents; index++) {
    const receiver = partiesByLargestRemainder[index % partiesByLargestRemainder.length]
    if (receiver) {
      cells[receiver.party] = (cells[receiver.party] ?? 0) + 1
    }
  }

  return cells
}

function proportionalShare(
  installment: Cents,
  partyTotal: Cents,
  total: Cents,
  party: number,
): ProportionalShare {
  const exact = BigInt(installment) * BigInt(partyTotal)
  const divisor = BigInt(total)
  return {
    party,
    cents: Number(exact / divisor),
    remainder: exact % divisor,
  }
}

function byLargestRemainderThenParty(a: ProportionalShare, b: ProportionalShare): number {
  if (a.remainder === b.remainder) {
    return a.party - b.party
  }
  return a.remainder > b.remainder ? -1 : 1
}

function remainingPerParty(partyTotals: readonly Cents[], allocatedSoFar: Cents[]): Cents[] {
  return partyTotals.map((partyTotal, party) => partyTotal - (allocatedSoFar[party] ?? 0))
}

function assertInstallmentCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`Installment count must be a positive integer: ${count}`)
  }
}

function assertAllocationInput(installments: readonly Cents[], partyTotals: readonly Cents[]) {
  if (installments.length === 0) {
    throw new RangeError('At least one installment is required')
  }
  if (partyTotals.length === 0) {
    throw new RangeError('At least one party is required')
  }

  for (const installment of installments) {
    assertPositiveCents(installment, 'installment')
  }
  for (const partyTotal of partyTotals) {
    assertPositiveCents(partyTotal, 'party total')
  }

  const installmentsTotal = sumCents(installments)
  const partiesTotal = sumCents(partyTotals)
  if (partiesTotal !== installmentsTotal) {
    throw new RangeError(
      `Party totals (${partiesTotal}) must equal the installments total (${installmentsTotal})`,
    )
  }
}

function assertNoNegativeShare(cells: readonly Cents[]): void {
  if (cells.some((cell) => cell < 0)) {
    throw new RangeError('A party share is too small to spread over these installments')
  }
}
