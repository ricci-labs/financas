import type { PostgresErrorField } from '@api/core/db/db.types'
export const POSTGRES_CHECK_VIOLATION = '23514'

export const POSTGRES_UNIQUE_VIOLATION = '23505'

export function postgresErrorCode(error: unknown): string | undefined {
  return findInErrorChain(error, 'code')
}

export function postgresConstraintName(error: unknown): string | undefined {
  return findInErrorChain(error, 'constraint')
}

function findInErrorChain(error: unknown, field: PostgresErrorField): string | undefined {
  let current: unknown = error
  while (current instanceof Error) {
    const value = (current as Error & Partial<Record<PostgresErrorField, unknown>>)[field]
    if (typeof value === 'string') {
      return value
    }
    current = current.cause
  }
  return undefined
}
