import {
  invoiceForPurchase,
  invoiceStatusOn,
  invoicesForInstallments,
} from '@shared/cards/billing-cycle'
import type { CardCycle } from '@shared/cards/cards.types'
import { describe, expect, it } from 'vitest'

const cardX: CardCycle = { closingDay: 3, dueDay: 10, purchaseOnClosingDayGoesNext: true }
const cardY: CardCycle = { closingDay: 28, dueDay: 5, purchaseOnClosingDayGoesNext: true }
const cardZ: CardCycle = { closingDay: 31, dueDay: 8, purchaseOnClosingDayGoesNext: true }

describe('invoiceForPurchase', () => {
  it.each([
    ['Card X', cardX, '2026-09-02', '2026-09-03', '2026-09-10', '2026-09'],
    ['Card X', cardX, '2026-09-03', '2026-10-03', '2026-10-10', '2026-10'],
    ['Card X', cardX, '2026-09-15', '2026-10-03', '2026-10-10', '2026-10'],
    ['Card Y', cardY, '2026-09-20', '2026-09-28', '2026-10-05', '2026-10'],
    ['Card Y', cardY, '2026-09-28', '2026-10-28', '2026-11-05', '2026-11'],
    ['Card Z', cardZ, '2026-09-10', '2026-09-30', '2026-10-08', '2026-10'],
    ['Card Z', cardZ, '2027-02-10', '2027-02-28', '2027-03-08', '2027-03'],
  ])('%s: purchase on %s', (_name, card, purchase, closingOn, dueOn, referenceMonth) => {
    expect(invoiceForPurchase(purchase, card)).toEqual({ closingOn, dueOn, referenceMonth })
  })

  it('keeps a closing-day purchase in the closing invoice when the issuer does so', () => {
    const card = { ...cardX, purchaseOnClosingDayGoesNext: false }
    expect(invoiceForPurchase('2026-09-03', card).closingOn).toBe('2026-09-03')
  })

  it('rejects invalid card days', () => {
    expect(() => invoiceForPurchase('2026-09-01', { ...cardX, closingDay: 0 })).toThrow(RangeError)
    expect(() => invoiceForPurchase('2026-09-01', { ...cardX, dueDay: 32 })).toThrow(RangeError)
  })
})

describe('invoicesForInstallments', () => {
  it('Card X, purchase 2026-09-15 in 3×', () => {
    expect(invoicesForInstallments('2026-09-15', cardX, 3).map((i) => i.dueOn)).toEqual([
      '2026-10-10',
      '2026-11-10',
      '2026-12-10',
    ])
  })

  it('crosses the year and clamps short months', () => {
    expect(invoicesForInstallments('2026-12-10', cardZ, 3).map((i) => i.closingOn)).toEqual([
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ])
  })
})

describe('invoiceStatusOn', () => {
  const october = { closingOn: '2026-10-03', referenceMonth: '2026-10' }
  const november = { closingOn: '2026-11-03', referenceMonth: '2026-11' }

  it('is open while purchases still land on it, future after it', () => {
    expect(invoiceStatusOn(october, '2026-09-15', cardX)).toBe('open')
    expect(invoiceStatusOn(november, '2026-09-15', cardX)).toBe('future')
  })

  it('closes on the closing day when closing-day purchases go to the next invoice', () => {
    expect(invoiceStatusOn(october, '2026-10-03', cardX)).toBe('closed')
    expect(invoiceStatusOn(november, '2026-10-03', cardX)).toBe('open')
  })

  it('closes the day after when the issuer keeps closing-day purchases', () => {
    const card = { ...cardX, purchaseOnClosingDayGoesNext: false }
    expect(invoiceStatusOn(october, '2026-10-03', card)).toBe('open')
    expect(invoiceStatusOn(october, '2026-10-04', card)).toBe('closed')
  })

  it('stays closed for good once its closing date passed', () => {
    expect(invoiceStatusOn(october, '2027-01-20', cardX)).toBe('closed')
  })
})
