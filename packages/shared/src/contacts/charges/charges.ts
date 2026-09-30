import type { ChargeStatus } from '@shared/contacts/charges/charges.constants'
import type {
  ChargeableItem,
  ChargeMessageInput,
  OpenItem,
} from '@shared/contacts/charges/charges.types'
import type { IsoDate } from '@shared/core/calendar/calendar.types'
import { formatBrl } from '@shared/core/money/money'

export function openItems(
  items: readonly ChargeableItem[],
  paidCents: number,
  { until, alreadyCharged }: { until: IsoDate; alreadyCharged: ReadonlySet<string> },
): OpenItem[] {
  let paymentLeft = paidCents
  const oldestFirst = [...items].sort(
    (left, right) =>
      left.effectiveOn.localeCompare(right.effectiveOn) ||
      left.postingId.localeCompare(right.postingId),
  )
  const withRemaining = oldestFirst.map((item) => {
    const covered = Math.min(paymentLeft, item.amountCents)
    paymentLeft -= covered
    return { ...item, remainingCents: item.amountCents - covered }
  })
  return withRemaining.filter(
    (item) =>
      item.remainingCents > 0 && item.effectiveOn <= until && !alreadyCharged.has(item.postingId),
  )
}

export function chargeMessage(input: ChargeMessageInput): string {
  const lines = input.items.map(
    (item) => `• ${item.description}${installmentLabel(item)} — ${formatBrl(item.remainingCents)}`,
  )
  return [
    `Oi, ${input.contactName}! ${input.requesterName} pediu para te lembrar do que está em aberto:`,
    ...lines,
    `Total: ${formatBrl(input.totalCents)}`,
    ...(input.dueOn ? [`Vencimento: ${brazilianDate(input.dueOn)}`] : []),
    ...(input.pixPayload ? ['Pix copia e cola:', input.pixPayload] : []),
  ].join('\n')
}

function installmentLabel(item: OpenItem): string {
  return item.installmentNo !== null && item.installmentCount > 1
    ? ` (parcela ${item.installmentNo}/${item.installmentCount})`
    : ''
}

function brazilianDate(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function chargeStatusOf(
  stored: ChargeStatus,
  amountCents: number,
  paidCents: number,
): ChargeStatus {
  if (stored === 'cancelled') {
    return stored
  }
  if (paidCents >= amountCents) {
    return 'paid'
  }
  return paidCents > 0 ? 'partially_paid' : stored
}
