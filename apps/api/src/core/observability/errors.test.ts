import { ConflictError } from '@api/core/http/errors'
import { errorCodeOf, fingerprintOf, logUnexpectedError } from '@api/core/observability/errors'
import { crashHandler } from '@api/core/observability/process'
import { createCapturingLogger } from '@api/testing/logger'
import { captureMetrics } from '@api/testing/metrics'
import { describe, expect, it } from 'vitest'

const captured = captureMetrics()

function explodeInsideApp(): never {
  throw new Error('database unreachable')
}

function caught(work: () => unknown): unknown {
  try {
    work()
  } catch (error) {
    return error
  }
  throw new Error('Nothing was thrown')
}

describe('errorCodeOf', () => {
  it('takes the app code, else the driver code of the error or its cause', () => {
    expect(errorCodeOf(new ConflictError('EMAIL_TAKEN', 'taken'))).toBe('EMAIL_TAKEN')
    expect(errorCodeOf(Object.assign(new Error('duplicate'), { code: '23505' }))).toBe('23505')
    expect(errorCodeOf(new Error('query failed', { cause: { code: '40001' } }))).toBe('40001')
    expect(errorCodeOf(new Error('plain'))).toBe('INTERNAL_ERROR')
    expect(errorCodeOf('a string')).toBe('INTERNAL_ERROR')
  })
})

describe('fingerprintOf', () => {
  it('names the type, the code and the first frame of the app, skipping libraries', () => {
    expect(fingerprintOf(caught(explodeInsideApp))).toBe('Error:INTERNAL_ERROR:explodeInsideApp')

    const fromLibrary = new TypeError('bad')
    fromLibrary.stack = [
      'TypeError: bad',
      '    at Parser.parse (/app/node_modules/pg/lib/parser.js:10:5)',
      '    at node:internal/process/task_queues:95:5',
      '    at async selectEntries (/app/dist/main.mjs:1200:7)',
    ].join('\n')
    expect(fingerprintOf(fromLibrary)).toBe('TypeError:INTERNAL_ERROR:selectEntries')

    const anonymous = new Error('x')
    anonymous.stack = 'Error: x\n    at /app/dist/main.mjs:88:3'
    expect(fingerprintOf(anonymous)).toBe('Error:INTERNAL_ERROR:main.mjs:88')
    expect(fingerprintOf('thrown text')).toBe('string:INTERNAL_ERROR:unknown')
  })
})

describe('logUnexpectedError', () => {
  it('logs the error once with its fingerprint and counts it by code and module', async () => {
    const { logger, entries } = createCapturingLogger()
    logUnexpectedError(
      logger,
      { event: 'job.run.failed', module: 'jobs', job: 'x' },
      caught(explodeInsideApp),
      'Job failed',
    )
    expect(entries()).toMatchObject([
      {
        level: 50,
        event: 'job.run.failed',
        module: 'jobs',
        job: 'x',
        fingerprint: 'Error:INTERNAL_ERROR:explodeInsideApp',
        err: { message: 'database unreachable' },
      },
    ])
    expect(await captured.scrape()).toContain(
      'financas_app_errors_total{code="INTERNAL_ERROR",module="jobs"} 1',
    )
  })
})

describe('crashHandler', () => {
  it('logs a fatal crash, then exits with 1 once the logs are flushed', async () => {
    const { logger, entries } = createCapturingLogger()
    const exited = new Promise<number>((resolve) => {
      crashHandler(logger, resolve)(caught(explodeInsideApp))
    })
    expect(await exited).toBe(1)
    expect(entries()).toMatchObject([
      { level: 60, event: 'process.crashed', fingerprint: 'Error:INTERNAL_ERROR:explodeInsideApp' },
    ])
  })
})
