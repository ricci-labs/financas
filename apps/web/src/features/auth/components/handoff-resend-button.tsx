import { Button } from '@web/components/actions/button'
import { showToast } from '@web/components/feedback/toast'
import { useResendVerification } from '@web/features/auth/api/use-resend-verification'
import { authMessages } from '@web/features/auth/auth.messages'
import type { HandoffResendProps } from '@web/features/auth/auth.types'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { useState } from 'react'

const RESEND_WAIT_MS = 60_000
const messages = authMessages.checkEmail

export function HandoffResendButton({ email }: HandoffResendProps) {
  const resend = useResendVerification()
  const [waitUntil, setWaitUntil] = useState(() => Date.now() + RESEND_WAIT_MS)

  async function resendNow() {
    try {
      await resend.mutateAsync(email)
      showToast(messages.resent)
      setWaitUntil(Date.now() + RESEND_WAIT_MS)
    } catch (error) {
      showToast(errorMessageFor(error))
    }
  }

  return (
    <Button
      variant="outline"
      surface="mint"
      width="full"
      isLoading={resend.isPending}
      waitUntil={waitUntil}
      waitLabel={messages.resendIn}
      onClick={resendNow}
    >
      {messages.resend}
    </Button>
  )
}
