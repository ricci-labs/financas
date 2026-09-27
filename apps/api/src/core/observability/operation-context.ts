import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import type { Operation } from '@api/core/observability/observability.types'

const TRACE_ID_BYTES = 16
const SYSTEM_OPERATION: Operation = { traceId: null, source: 'system' }
const operations = new AsyncLocalStorage<Operation>()

export function newTraceId(): string {
  return randomBytes(TRACE_ID_BYTES).toString('hex')
}

export function runInOperation<T>(operation: Operation, work: () => T): T {
  return operations.run(operation, work)
}

export function currentOperation(): Operation {
  return operations.getStore() ?? SYSTEM_OPERATION
}
