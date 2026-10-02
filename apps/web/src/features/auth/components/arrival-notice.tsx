import { Alert } from '@web/components/feedback/alert'
import { authMessages } from '@web/features/auth/auth.messages'
import type { ArrivalNotice, LoginNotice } from '@web/features/auth/auth.types'
import { fill } from '@web/lib/format/template'

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
        {fill(authMessages.login.joined, { workspaceName: joinedWorkspaceName })}
      </Alert>
    )
  }
  if (!notice) {
    return null
  }
  const { tone, message } = NOTICES[notice]
  return <Alert tone={tone}>{message}</Alert>
}
