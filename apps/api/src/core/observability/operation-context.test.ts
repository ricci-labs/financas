import {
  currentOperation,
  newTraceId,
  runAsActor,
  runInOperation,
} from '@api/core/observability/operation-context'
import { describe, expect, it } from 'vitest'

describe('operation context', () => {
  it('follows the work across awaits, and is the system outside any operation', async () => {
    const traceId = newTraceId()
    const seen = await runInOperation({ traceId, source: 'job', actorUserId: null }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return currentOperation()
    })
    expect(seen).toEqual({ traceId, source: 'job', actorUserId: null })
    expect(currentOperation()).toEqual({ traceId: null, source: 'system', actorUserId: null })
  })

  it('keeps concurrent operations apart', async () => {
    const inside = (traceId: string) =>
      runInOperation({ traceId, source: 'web', actorUserId: null }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return currentOperation().traceId
      })
    expect(await Promise.all([inside('a'), inside('b')])).toEqual(['a', 'b'])
  })

  it('adds the actor to the current operation, keeping its trace and source', async () => {
    const seen = await runInOperation({ traceId: 't', source: 'web', actorUserId: null }, () =>
      runAsActor('user-1', async () => currentOperation()),
    )
    expect(seen).toEqual({ traceId: 't', source: 'web', actorUserId: 'user-1' })
  })

  it('makes a new 32-hex trace id each time', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/)
    expect(newTraceId()).not.toBe(newTraceId())
  })
})
