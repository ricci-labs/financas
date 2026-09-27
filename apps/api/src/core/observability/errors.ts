import { AppError } from '@api/core/http/errors'
import type { Logger } from '@api/core/observability/logger'
import { appMetrics } from '@api/core/observability/metrics'
import type { UnexpectedError } from '@api/core/observability/observability.types'

const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR'
const UNKNOWN_FRAME = 'unknown'
const STACK_FRAME = /^\s*at (?:async )?(?:(\S+) \()?(.+?):(\d+):\d+\)?$/
const LIBRARY_PATHS = ['node_modules', 'node:']

export function errorCodeOf(error: unknown): string {
  if (error instanceof AppError) {
    return error.code
  }
  const code = codeProperty(error) ?? codeProperty((error as { cause?: unknown } | null)?.cause)
  return code ?? INTERNAL_ERROR_CODE
}

export function fingerprintOf(error: unknown): string {
  const type = error instanceof Error ? error.name : typeof error
  return `${type}:${errorCodeOf(error)}:${topFrameOf(error)}`
}

export function logUnexpectedError(
  logger: Logger,
  { event, module, ...context }: UnexpectedError,
  error: unknown,
  message: string,
): void {
  logger.error(
    { ...context, event, module, err: error, fingerprint: fingerprintOf(error) },
    message,
  )
  appMetrics().appErrors.add(1, { code: errorCodeOf(error), module })
}

function topFrameOf(error: unknown): string {
  const stack = error instanceof Error ? (error.stack ?? '') : ''
  for (const line of stack.split('\n').slice(1)) {
    const frame = line.match(STACK_FRAME)
    if (!frame || LIBRARY_PATHS.some((path) => line.includes(path))) {
      continue
    }
    const [, functionName, file, lineNumber] = frame
    return functionName ?? `${file?.split('/').at(-1)}:${lineNumber}`
  }
  return UNKNOWN_FRAME
}

function codeProperty(value: unknown): string | undefined {
  const code = (value as { code?: unknown } | null | undefined)?.code
  return typeof code === 'string' ? code : undefined
}
