export const POSTGRES_CHECK_VIOLATION = '23514'

export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  while (current instanceof Error) {
    const code = (current as Error & { code?: unknown }).code
    if (typeof code === 'string') {
      return code
    }
    current = current.cause
  }
  return undefined
}
