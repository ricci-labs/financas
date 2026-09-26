import type { Database } from '@api/core/db/db.types'
import { pageLink } from '@api/core/email/links'
import { parseOrThrow, ValidationError } from '@api/core/http/errors'
import { hashPassword } from '@api/core/security/passwords'
import { hashToken } from '@api/core/security/tokens'
import { passwordChangedMessage, passwordResetMessage } from '@api/modules/identity/identity.emails'
import {
  findAccountByEmail,
  isUsableAuthToken,
  resetPasswordWithToken,
} from '@api/modules/identity/identity.repository'
import type {
  AccountEmailDeps,
  EmailOnlyInput,
  EmailRecipient,
  ResetPasswordInput,
} from '@api/modules/identity/identity.types'
import { issueAuthToken } from '@api/modules/identity/use-cases/auth-tokens'
import { withDefaults } from '@api/modules/identity/use-cases/defaults'
import { emailSchema, passwordSchema } from '@financas/shared'

const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000
const RESET_PASSWORD_PATH = '/reset-password'
const FORGOT_PASSWORD_PATH = '/forgot-password'

export async function requestPasswordReset(
  db: Database,
  input: EmailOnlyInput,
  deps: AccountEmailDeps,
): Promise<void> {
  const { clock } = withDefaults(deps)
  const email = emailSchema.safeParse(input.email)
  if (!email.success) {
    return
  }

  const account = await findAccountByEmail(db, email.data)
  if (!account || account.disabledAt) {
    return
  }

  const token = await issueAuthToken(
    db,
    account.userId,
    'password_reset',
    PASSWORD_RESET_LIFETIME_MS,
    clock.now(),
  )
  const resetLink = pageLink(deps.publicUrl, RESET_PASSWORD_PATH, token)
  await deps.mailer.send(passwordResetMessage({ recipient: account, resetLink }))
}

export async function resetPassword(
  db: Database,
  input: ResetPasswordInput,
  deps: AccountEmailDeps,
): Promise<void> {
  const { clock, passwordCost } = withDefaults(deps)
  const password = parseOrThrow(passwordSchema, input.password, 'PASSWORD_INVALID')
  const tokenHash = hashToken(input.token)
  if (!(await isUsableAuthToken(db, tokenHash, 'password_reset', clock.now()))) {
    throw invalidLink()
  }

  const passwordHash = await hashPassword(password, passwordCost)
  const changed = await resetPasswordWithToken(db, tokenHash, passwordHash, clock.now())
  if (!changed) {
    throw invalidLink()
  }

  await sendPasswordChangedEmail(changed, deps)
}

export async function sendPasswordChangedEmail(
  recipient: EmailRecipient,
  deps: AccountEmailDeps,
): Promise<void> {
  const forgotPasswordLink = pageLink(deps.publicUrl, FORGOT_PASSWORD_PATH)
  await deps.mailer.send(passwordChangedMessage({ recipient, forgotPasswordLink }))
}

function invalidLink(): ValidationError {
  return new ValidationError('LINK_INVALID', 'The link is invalid, already used or expired')
}
