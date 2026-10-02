import { Button } from '@web/components/actions/button'
import { showToast } from '@web/components/feedback/toast'
import { useResendVerification } from '@web/features/auth/api/use-resend-verification'
import { authMessages } from '@web/features/auth/auth.messages'
import type { ResendVerificationProps } from '@web/features/auth/auth.types'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { Mail } from 'lucide-react'
import { useState } from 'react'

const RESEND_WAIT_MS = 60_000

export function ResendVerificationButton({ email }: ResendVerificationProps) {
  const resend = useResendVerification()
  const [waitUntil, setWaitUntil] = useState<number | null>(null)

  async function resendNow() {
    try {
      await resend.mutateAsync(email)
      setWaitUntil(Date.now() + RESEND_WAIT_MS)
    } catch (error) {
      showToast(errorMessageFor(error))
    }
  }

  return (
    <Button
      variant="subtle"
      size="sm"
      isLoading={resend.isPending}
      waitUntil={waitUntil}
      waitLabel={authMessages.login.resendIn}
      onClick={resendNow}
    >
      <Mail aria-hidden="true" />
      {authMessages.login.resendVerification}
    </Button>
  )
}
