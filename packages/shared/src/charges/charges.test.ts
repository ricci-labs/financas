import { chargeMessage, chargeStatusOf, openItems } from '@shared/charges/charges'
import type { ChargeableItem } from '@shared/charges/charges.types'
import { describe, expect, it } from 'vitest'

function item(
  postingId: string,
  effectiveOn: string,
  amountCents: number,
  installmentNo: number | null = null,
): ChargeableItem {
  return {
    postingId,
    description: 'TV',
    installmentNo,
    installmentCount: installmentNo ? 3 : 1,
    effectiveOn,
    amountCents,
  }
}

const TV = [
  item('p1', '2026-10-10', 10_000, 1),
  item('p2', '2026-11-10', 10_000, 2),
  item('p3', '2026-12-10', 10_000, 3),
]

describe('openItems', () => {
  it('pays the oldest items first and keeps what is still open up to the date', () => {
    const open = openItems(TV, 14_000, { until: '2026-11-30', alreadyCharged: new Set() })
    expect(open.map((open) => [open.postingId, open.remainingCents])).toEqual([['p2', 6_000]])
  })

  it('leaves out items already in an open charge', () => {
    const open = openItems(TV, 0, { until: '2026-12-31', alreadyCharged: new Set(['p1']) })
    expect(open.map((open) => open.postingId)).toEqual(['p2', 'p3'])
  })

  it('orders items of the same day by posting, whatever the input order', () => {
    const sameDay = [item('b', '2026-10-10', 1_000), item('a', '2026-10-10', 1_000)]
    const open = openItems(sameDay, 1_000, { until: '2026-10-31', alreadyCharged: new Set() })
    expect(open.map((open) => open.postingId)).toEqual(['b'])
  })
})

describe('chargeMessage', () => {
  it('lists the items, the total, the due date and the Pix copia e cola in pt-BR', () => {
    const items = openItems(TV, 0, { until: '2026-11-30', alreadyCharged: new Set() })
    expect(
      chargeMessage({
        contactName: 'Contact J',
        requesterName: 'Member A',
        items,
        totalCents: 20_000,
        dueOn: '2026-11-10',
        pixPayload: '000201...',
      }),
    ).toBe(
      [
        'Oi, Contact J! Member A pediu para te lembrar do que está em aberto:',
        '• TV (parcela 1/3) — R$ 100,00',
        '• TV (parcela 2/3) — R$ 100,00',
        'Total: R$ 200,00',
        'Vencimento: 10/11/2026',
        'Pix copia e cola:',
        '000201...',
      ].join('\n'),
    )
  })

  it('leaves out the installment, the due date and the Pix when there are none', () => {
    const message = chargeMessage({
      contactName: 'Contact M',
      requesterName: 'Member B',
      items: [
        {
          ...item('p9', '2026-10-01', 5_000),
          description: 'Jantar',
          installmentNo: 1,
          installmentCount: 1,
          remainingCents: 5_000,
        },
      ],
      totalCents: 5_000,
      dueOn: null,
      pixPayload: null,
    })
    expect(message).toBe(
      'Oi, Contact M! Member B pediu para te lembrar do que está em aberto:\n• Jantar — R$ 50,00\nTotal: R$ 50,00',
    )
  })
})

describe('chargeStatusOf', () => {
  it('derives paid and partially paid from the payments, keeping cancelled and the lifecycle', () => {
    expect(chargeStatusOf('sent', 10_000, 0)).toBe('sent')
    expect(chargeStatusOf('sent', 10_000, 4_000)).toBe('partially_paid')
    expect(chargeStatusOf('draft', 10_000, 10_000)).toBe('paid')
    expect(chargeStatusOf('sent', 10_000, 12_000)).toBe('paid')
    expect(chargeStatusOf('cancelled', 10_000, 10_000)).toBe('cancelled')
  })
})
