import { authMessages } from '@web/features/auth/auth.messages'
import { PasswordLinkInvalid } from '@web/features/auth/components/password-link-invalid'
import { ResetPasswordForm } from '@web/features/auth/components/reset-password-form'
import { useLinkToken } from '@web/hooks/use-link-token'
import { usePageTitle } from '@web/hooks/use-page-title'
import { useState } from 'react'

export function ResetPasswordPage() {
  usePageTitle(authMessages.resetPassword.pageTitle)
  const token = useLinkToken()
  const [isLinkInvalid, setIsLinkInvalid] = useState(false)

  if (!token || isLinkInvalid) {
    return <PasswordLinkInvalid wasTried={isLinkInvalid} />
  }
  return <ResetPasswordForm token={token} onLinkInvalid={() => setIsLinkInvalid(true)} />
}
