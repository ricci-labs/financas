import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'

const messages = authMessages.signUpClosed

export function SignUpClosed() {
  return (
    <MomentScreen
      tone="calm"
      kit={{ kit: 'closed' }}
      title={messages.title}
      actions={
        <Button width="full" render={<Link to="/login" />}>
          {messages.goToLogIn}
        </Button>
      }
    >
      <p>{messages.text}</p>
    </MomentScreen>
  )
}
