import { allocateAcrossInstallments, splitInstallments } from '@shared/domain/installments'
import { describe, expect, it } from 'vitest'

describe('splitInstallments', () => {
  it.each([
    [100000, 3, [33334, 33333, 33333]],
    [250000, 10, Array(10).fill(25000)],
    [10000, 3, [3334, 3333, 3333]],
    [999, 1, [999]],
  ])('%i cents in %i×', (total, count, expected) => {
    expect(splitInstallments(total, count)).toEqual(expected)
  })

  it('rejects invalid input', () => {
    expect(() => splitInstallments(0, 1)).toThrow(RangeError)
    expect(() => splitInstallments(1000, 0)).toThrow(RangeError)
    expect(() => splitInstallments(10.5, 2)).toThrow(RangeError)
    expect(() => splitInstallments(2, 3)).toThrow(RangeError)
  })
})

describe('allocateAcrossInstallments', () => {
  it('TV R$ 1.200,00 in 3×, Contact J owes R$ 300,00 (clean case)', () => {
    expect(allocateAcrossInstallments([40000, 40000, 40000], [90000, 30000])).toEqual([
      [30000, 10000],
      [30000, 10000],
      [30000, 10000],
    ])
  })

  it('R$ 1.000,00 in 3×, Contact J owes R$ 500,00 (rounding case)', () => {
    expect(allocateAcrossInstallments([33334, 33333, 33333], [50000, 50000])).toEqual([
      [16667, 16667],
      [16667, 16666],
      [16666, 16667],
    ])
  })

  it('dinner R$ 300,00 in 1×, J and M owe R$ 100,00 each', () => {
    expect(allocateAcrossInstallments([30000], [10000, 10000, 10000])).toEqual([
      [10000, 10000, 10000],
    ])
  })

  it('rows sum to installments and columns to party totals', () => {
    const installments = splitInstallments(123457, 7)
    const parties = [60001, 33333, 30123]
    const grid = allocateAcrossInstallments(installments, parties)
    grid.forEach((row, i) => {
      expect(row.reduce((a, b) => a + b, 0)).toBe(installments[i])
    })
    parties.forEach((total, p) => {
      expect(grid.reduce((sum, row) => sum + (row[p] ?? 0), 0)).toBe(total)
    })
    expect(grid.flat().every((cell) => cell >= 0)).toBe(true)
  })

  it('handles amounts whose products exceed 2^53', () => {
    const installments = splitInstallments(9_000_000_000_00, 3)
    const grid = allocateAcrossInstallments(installments, [6_000_000_000_00, 3_000_000_000_00])
    expect(grid[0]).toEqual([2_000_000_000_00, 1_000_000_000_00])
  })

  it('rejects party totals that do not add up', () => {
    expect(() => allocateAcrossInstallments([10000], [5000, 4000])).toThrow(RangeError)
  })
})
