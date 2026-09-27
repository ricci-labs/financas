import {
  currentOperation,
  newTraceId,
  runInOperation,
} from '@api/core/observability/operation-context'
import { describe, expect, it } from 'vitest'

describe('operation context', () => {
  it('follows the work across awaits, and is the system outside any operation', async () => {
    const traceId = newTraceId()
    const seen = await runInOperation({ traceId, source: 'job' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return currentOperation()
    })
    expect(seen).toEqual({ traceId, source: 'job' })
    expect(currentOperation()).toEqual({ traceId: null, source: 'system' })
  })

  it('keeps concurrent operations apart', async () => {
    const inside = (traceId: string) =>
      runInOperation({ traceId, source: 'web' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return currentOperation().traceId
      })
    expect(await Promise.all([inside('a'), inside('b')])).toEqual(['a', 'b'])
  })

  it('makes a new 32-hex trace id each time', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/)
    expect(newTraceId()).not.toBe(newTraceId())
  })
})
