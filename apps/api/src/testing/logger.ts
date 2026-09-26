import { createLogger } from '@api/core/observability/logger'

export function createCapturingLogger(level: 'info' | 'debug' = 'info') {
  const lines: string[] = []
  const logger = createLogger(
    { LOG_LEVEL: level, NODE_ENV: 'test', APP_VERSION: 'test-sha' },
    { write: (line: string) => lines.push(line) },
  )
  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  return { logger, entries, output: () => lines.join('') }
}
