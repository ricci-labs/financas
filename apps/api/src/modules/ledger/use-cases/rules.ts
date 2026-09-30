import {
  POSTGRES_CHECK_VIOLATION,
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { ConflictError, ValidationError } from '@api/core/http/errors'

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

const NON_MEMBER_CODES = new Map([
  ['ledger_accounts_owner_is_member', 'OWNER_NOT_A_MEMBER'],
  ['card_details_holder_is_member', 'HOLDER_NOT_A_MEMBER'],
])

export async function refusingNonMembers<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const code = NON_MEMBER_CODES.get(postgresConstraintName(error) ?? '')
    if (code) {
      throw new ValidationError(code, 'That person is not a member of this workspace', {
        cause: error,
      })
    }
    throw error
  }
}
