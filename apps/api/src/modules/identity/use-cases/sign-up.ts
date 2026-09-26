import type { Database } from '@api/core/db/db.types'
import { pageLink } from '@api/core/email/links'
import { AppError, ForbiddenError, parseOrThrow } from '@api/core/http/errors'
import { accountAlreadyExistsMessage } from '@api/modules/identity/identity.emails'
import { findAccountByEmail } from '@api/modules/identity/identity.repository'
import type { SignUpDeps, SignUpInput } from '@api/modules/identity/identity.types'
import { sendEmailVerification } from '@api/modules/identity/use-cases/email-verification'
import { createUser } from '@api/modules/identity/use-cases/users'
import { newUserSchema } from '@financas/shared'

const LOGIN_PATH = '/login'
const FORGOT_PASSWORD_PATH = '/forgot-password'

export async function signUp(db: Database, input: SignUpInput, deps: SignUpDeps): Promise<void> {
  if (!deps.isPublicSignupEnabled) {
    throw new ForbiddenError('SIGNUP_DISABLED', 'Public sign-up is turned off')
  }

  const newUser = parseOrThrow(newUserSchema, input, 'USER_INVALID')
  try {
    const userId = await createUser(db, { ...newUser, isEmailVerified: false }, deps)
    await sendEmailVerification(
      db,
      { userId, email: newUser.email, displayName: newUser.displayName },
      deps,
    )
  } catch (error) {
    if (!isTakenEmail(error)) {
      throw error
    }
    await warnExistingAccount(db, newUser.email, deps)
  }
}

async function warnExistingAccount(db: Database, email: string, deps: SignUpDeps): Promise<void> {
  const account = await findAccountByEmail(db, email)
  if (!account || account.disabledAt) {
    return
  }
  await deps.mailer.send(
    accountAlreadyExistsMessage({
      recipient: account,
      loginLink: pageLink(deps.publicUrl, LOGIN_PATH),
      forgotPasswordLink: pageLink(deps.publicUrl, FORGOT_PASSWORD_PATH),
    }),
  )
}

function isTakenEmail(error: unknown): boolean {
  return error instanceof AppError && error.code === 'EMAIL_TAKEN'
}
