import type { Database } from '@api/core/db/client'
import {
  POSTGRES_UNIQUE_VIOLATION,
  postgresConstraintName,
  postgresErrorCode,
} from '@api/core/db/errors'
import { ConflictError, parseOrThrow } from '@api/core/http/errors'
import { hashPassword } from '@api/core/security/passwords'
import { insertUser } from '@api/modules/identity/identity.repository'
import type { IdentityDeps, NewUserInput } from '@api/modules/identity/identity.types'
import { withDefaults } from '@api/modules/identity/use-cases/defaults'
import { newUserSchema } from '@financas/shared'

const USER_EMAIL_CONSTRAINT = 'users_email_unique'

export async function createUser(
  db: Database,
  input: NewUserInput,
  deps: Partial<IdentityDeps> = {},
): Promise<string> {
  const { clock, passwordCost } = withDefaults(deps)
  const user = parseOrThrow(newUserSchema, input, 'USER_INVALID')
  const passwordHash = await hashPassword(user.password, passwordCost)

  return refusingTakenEmail(() =>
    insertUser(db, {
      email: user.email,
      displayName: user.displayName,
      passwordHash,
      emailVerifiedAt: input.isEmailVerified ? clock.now() : null,
    }),
  )
}

async function refusingTakenEmail<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    const isTakenEmail =
      postgresErrorCode(error) === POSTGRES_UNIQUE_VIOLATION &&
      postgresConstraintName(error) === USER_EMAIL_CONSTRAINT
    if (isTakenEmail) {
      throw new ConflictError('EMAIL_TAKEN', 'Another user has this email', { cause: error })
    }
    throw error
  }
}
