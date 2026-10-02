import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'
import type { InvalidInvitationProps } from '@web/features/auth/auth.types'

const messages = authMessages.invitation

export function InvalidInvitation({ code }: InvalidInvitationProps) {
  const { title, text } = messages.invalid[code]
  return (
    <MomentScreen tone="calm" scene="linkExpired" title={title} actions={<GoToLogIn />}>
      {text && <p>{text}</p>}
    </MomentScreen>
  )
}

export function GoToLogIn() {
  return (
    <Button width="full" render={<Link to="/login" />}>
      {messages.goToLogIn}
    </Button>
  )
}
