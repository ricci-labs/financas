import { PasswordLinkInvalid } from '@web/features/auth/components/password-link-invalid'
import { ResetPasswordForm } from '@web/features/auth/components/reset-password-form'
import { useLinkToken } from '@web/hooks/use-link-token'
import { useState } from 'react'

export function ResetPasswordPage() {
  const token = useLinkToken()
  const [isLinkInvalid, setIsLinkInvalid] = useState(false)

  if (!token || isLinkInvalid) {
    return <PasswordLinkInvalid />
  }
  return <ResetPasswordForm token={token} onLinkInvalid={() => setIsLinkInvalid(true)} />
}
