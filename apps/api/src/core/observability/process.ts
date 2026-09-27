import { fingerprintOf } from '@api/core/observability/errors'
import type { Logger } from '@api/core/observability/logger'
import { appMetrics } from '@api/core/observability/metrics'

const CRASH_EXIT_CODE = 1

export function crashHandler(logger: Logger, exit: (code: number) => void) {
  return (error: unknown) => {
    logger.fatal(
      { event: 'process.crashed', err: error, fingerprint: fingerprintOf(error) },
      'Process crashed',
    )
    appMetrics().appErrors.add(1, { code: 'PROCESS_CRASHED', module: 'process' })
    logger.flush(() => exit(CRASH_EXIT_CODE))
  }
}

export function exitOnCrash(logger: Logger): void {
  const crash = crashHandler(logger, (code) => process.exit(code))
  process.on('uncaughtException', crash)
  process.on('unhandledRejection', crash)
}
