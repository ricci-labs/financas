import { contactBalances } from '@shared/contacts/contacts/balances'
import { describe, expect, it } from 'vitest'

const TODAY = '2026-10-15'

describe('contactBalances', () => {
  it('says what each contact owes, what is overdue and what comes next', () => {
    const balances = contactBalances(
      [
        { contactId: 'j', amountCents: 10_000, effectiveOn: '2026-10-10' },
        { contactId: 'j', amountCents: 10_000, effectiveOn: '2026-11-10' },
        { contactId: 'j', amountCents: 5_000, effectiveOn: '2026-11-10' },
        { contactId: 'j', amountCents: 10_000, effectiveOn: '2026-12-10' },
        { contactId: 'j', amountCents: -4_000, effectiveOn: '2026-10-12' },
        { contactId: 'm', amountCents: 3_000, effectiveOn: '2026-10-01' },
      ],
      TODAY,
    )
    expect(balances).toEqual([
      {
        contactId: 'j',
        owedCents: 31_000,
        overdueCents: 6_000,
        nextDueOn: '2026-11-10',
        nextDueCents: 15_000,
      },
      { contactId: 'm', owedCents: 3_000, overdueCents: 3_000, nextDueOn: null, nextDueCents: 0 },
    ])
  })

  it('counts a payment ahead of time against what is due, never below zero overdue', () => {
    const [paidAhead] = contactBalances(
      [
        { contactId: 'j', amountCents: 10_000, effectiveOn: '2026-10-10' },
        { contactId: 'j', amountCents: 10_000, effectiveOn: '2026-11-10' },
        { contactId: 'j', amountCents: -15_000, effectiveOn: '2026-10-11' },
      ],
      TODAY,
    )
    expect(paidAhead).toMatchObject({ owedCents: 5_000, overdueCents: 0 })
  })

  it('counts an item due today as overdue', () => {
    const [dueToday] = contactBalances(
      [{ contactId: 'j', amountCents: 1_000, effectiveOn: TODAY }],
      TODAY,
    )
    expect(dueToday?.overdueCents).toBe(1_000)
  })
})
