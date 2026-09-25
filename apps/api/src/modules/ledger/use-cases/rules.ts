import {
  POSTGRES_CHECK_VIOLATION,
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { ConflictError, ValidationError } from '@api/core/http/errors'
import type { z } from 'zod'

export async function refusingBrokenRules<T>(code: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (postgresErrorCode(error) === POSTGRES_CHECK_VIOLATION) {
      throw new ConflictError(code, 'The ledger rules refuse this change', { cause: error })
    }
    throw error
  }
}

const SIBLING_NAME_CONSTRAINT = 'ledger_accounts_sibling_name_unique'

export async function refusingTakenAccountNames<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const isTakenName =
      postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION &&
      postgresConstraintName(error) === SIBLING_NAME_CONSTRAINT
    if (isTakenName) {
      throw new ConflictError('ACCOUNT_NAME_TAKEN', 'Another account here has this name', {
        cause: error,
      })
    }
    throw error
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, rawInput: unknown, invalidCode: string): T {
  const parsed = schema.safeParse(rawInput)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    const field = issue?.path.join('.') || 'input'
    throw new ValidationError(invalidCode, `${field}: ${issue?.message ?? 'invalid'}`)
  }
  return parsed.data
}
