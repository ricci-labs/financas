import { RichText } from '@web/components/display/rich-text'
import { Alert } from '@web/components/feedback/alert'
import { authMessages } from '@web/features/auth/auth.messages'
import type { ArrivalNotice, LoginNotice } from '@web/features/auth/auth.types'

const NOTICES: Record<LoginNotice, ArrivalNotice> = {
  'session-ended': { tone: 'info', message: authMessages.login.notices['session-ended'] },
  'logged-out': { tone: 'info', message: authMessages.login.notices['logged-out'] },
  'password-changed': { tone: 'success', message: authMessages.login.notices['password-changed'] },
  'email-verified': { tone: 'success', message: authMessages.login.notices['email-verified'] },
}

export function arrivalNoticeOf(
  notice: LoginNotice | undefined,
  joinedWorkspaceName: string | undefined,
) {
  if (joinedWorkspaceName) {
    return (
      <Alert tone="success">
        <RichText
          text={authMessages.login.joined}
          values={{ workspaceName: joinedWorkspaceName }}
        />
      </Alert>
    )
  }
  if (!notice) {
    return null
  }
  const { tone, message } = NOTICES[notice]
  return <Alert tone={tone}>{message}</Alert>
}
