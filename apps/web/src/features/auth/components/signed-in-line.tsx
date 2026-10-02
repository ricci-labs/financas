import { RichText } from '@web/components/display/rich-text'
import { authMessages } from '@web/features/auth/auth.messages'
import type { SignedInLineProps } from '@web/features/auth/auth.types'

export function SignedInLine({ account, action }: SignedInLineProps) {
  return (
    <p className="text-body-sm">
      <RichText text={authMessages.invitation.signedInAs} values={{ email: account.email }} />
      {action && <> {action}</>}
    </p>
  )
}
