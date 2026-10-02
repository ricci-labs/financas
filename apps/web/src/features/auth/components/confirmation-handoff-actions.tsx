import { Link } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import { authMessages } from '@web/features/auth/auth.messages'
import type { ConfirmationHandoffActionsProps } from '@web/features/auth/auth.types'
import { HandoffResendButton } from '@web/features/auth/components/handoff-resend-button'

const messages = authMessages.checkEmail

export function ConfirmationHandoffActions({ email, logInLabel }: ConfirmationHandoffActionsProps) {
  return (
    <>
      <HandoffResendButton email={email} />
      <p className="text-body-sm">
        {messages.alreadyConfirmed}{' '}
        <TextLink tone="inherit" render={<Link to="/login" />}>
          {logInLabel}
        </TextLink>
      </p>
    </>
  )
}
