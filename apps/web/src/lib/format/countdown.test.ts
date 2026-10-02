import { formatMinutesAndSeconds, formatSeconds } from '@web/lib/format/countdown'
import { describe, expect, it } from 'vitest'

describe('formatSeconds', () => {
  it.each([
    [60, '60 s'],
    [52, '52 s'],
    [51.2, '52 s'],
    [-3, '0 s'],
  ])('writes %s seconds as %s', (seconds, text) => {
    expect(formatSeconds(seconds)).toBe(text)
  })
})

describe('formatMinutesAndSeconds', () => {
  it.each([
    [2388, '39:48'],
    [892, '14:52'],
    [45, '0:45'],
    [0, '0:00'],
  ])('writes %s seconds as %s', (seconds, text) => {
    expect(formatMinutesAndSeconds(seconds)).toBe(text)
  })
})
