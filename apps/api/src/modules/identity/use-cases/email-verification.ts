import type { Database } from '@api/core/db/db.types'
import { pageLink } from '@api/core/email/links'
import { ValidationError } from '@api/core/http/errors'
import { hashToken } from '@api/core/security/tokens'
import { emailVerificationMessage } from '@api/modules/identity/identity.emails'
import { findAccountByEmail, verifyEmailWithToken } from '@api/modules/identity/identity.repository'
import type {
  AccountEmailDeps,
  EmailOnlyInput,
  EmailRecipient,
  IdentityDeps,
} from '@api/modules/identity/identity.types'
import { issueAuthToken } from '@api/modules/identity/use-cases/auth-tokens'
import { withDefaults } from '@api/modules/identity/use-cases/defaults'
import { emailSchema } from '@financas/shared'

const EMAIL_VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000
const VERIFY_EMAIL_PATH = '/verify-email'

export async function sendEmailVerification(
  db: Database,
  recipient: EmailRecipient,
  deps: AccountEmailDeps,
): Promise<void> {
  const { clock } = withDefaults(deps)
  const token = await issueAuthToken(
    db,
    recipient.userId,
    'email_verification',
    EMAIL_VERIFICATION_LIFETIME_MS,
    clock.now(),
  )
  const verifyLink = pageLink(deps.publicUrl, VERIFY_EMAIL_PATH, token)
  await deps.mailer.send(emailVerificationMessage({ recipient, verifyLink }))
}

export async function requestEmailVerification(
  db: Database,
  input: EmailOnlyInput,
  deps: AccountEmailDeps,
): Promise<void> {
  const email = emailSchema.safeParse(input.email)
  if (!email.success) {
    return
  }

  const account = await findAccountByEmail(db, email.data)
  const needsVerification = account && !account.emailVerifiedAt && !account.disabledAt
  if (!needsVerification) {
    return
  }
  await sendEmailVerification(db, account, deps)
}

export async function verifyEmail(
  db: Database,
  token: string,
  deps: Partial<IdentityDeps> = {},
): Promise<void> {
  const { clock } = withDefaults(deps)
  const verifiedUserId = await verifyEmailWithToken(db, hashToken(token), clock.now())
  if (!verifiedUserId) {
    throw new ValidationError('LINK_INVALID', 'The link is invalid, already used or expired')
  }
}
