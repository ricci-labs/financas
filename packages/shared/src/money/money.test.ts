import { formatBrl, parseBrl, sumCents } from '@shared/money/money'
import { describe, expect, it } from 'vitest'

describe('parseBrl', () => {
  it.each([
    ['87,50', 8750],
    ['87,5', 8750],
    ['R$ 1.234,56', 123456],
    ['r$1234,56', 123456],
    ['1234.5', 123450],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['50', 5000],
    [' 0,99 ', 99],
  ])('%s → %i', (input, cents) => {
    expect(parseBrl(input)).toBe(cents)
  })

  it.each(['', 'abc', '1,234,56', '12,345', '-10', '1.23.4'])('rejects %j', (input) => {
    expect(() => parseBrl(input)).toThrow(RangeError)
  })
})

describe('formatBrl', () => {
  it('formats with the pt-BR currency style', () => {
    expect(formatBrl(8750)).toBe('R$ 87,50')
    expect(formatBrl(123456)).toBe('R$ 1.234,56')
  })

  it('rejects non-integer cents', () => {
    expect(() => formatBrl(1.5)).toThrow(RangeError)
  })
})

describe('sumCents', () => {
  it('adds integer cents', () => {
    expect(sumCents([100, 250, -50])).toBe(300)
  })
})
