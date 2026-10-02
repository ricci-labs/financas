import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { TextLink } from '@web/components/actions/text-link'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'
import type { PasswordLinkInvalidProps } from '@web/features/auth/auth.types'

const messages = authMessages.resetPassword

export function PasswordLinkInvalid({ wasTried }: PasswordLinkInvalidProps) {
  return (
    <MomentScreen
      tone="calm"
      {...(wasTried
        ? { kit: { kit: 'reset-expired' as const } }
        : { scene: 'linkExpired' as const })}
      title={messages.linkInvalid.title}
      actions={
        <>
          <Button width="full" render={<Link to="/forgot-password" />}>
            {messages.linkInvalid.askAgain}
          </Button>
          <p className="text-body-sm">
            {messages.remembered}{' '}
            <TextLink tone="inherit" render={<Link to="/login" />}>
              {messages.backToLogIn}
            </TextLink>
          </p>
        </>
      }
    >
      <p>{messages.linkInvalid.text}</p>
    </MomentScreen>
  )
}
