import { useVerifyEmail } from '@web/features/auth/api/use-verify-email'
import { authMessages } from '@web/features/auth/auth.messages'
import type { VerificationView } from '@web/features/auth/auth.types'
import { CheckYourEmail } from '@web/features/auth/components/check-your-email'
import { VerificationMoment } from '@web/features/auth/components/verification-moment'
import { useLinkToken } from '@web/hooks/use-link-token'
import { ApiError, NetworkError } from '@web/lib/api/api-error'
import { errorMessageFor, retryMinutesOf } from '@web/lib/errors/error-message'
import { useEffect, useRef, useState } from 'react'

const LINK_LIMIT_WINDOW_MINUTES = 60
const messages = authMessages.checkEmail

export function VerifyEmailPage() {
  const token = useLinkToken()
  const { mutate: confirm, isSuccess, error } = useVerifyEmail()
  const hasStarted = useRef(false)
  const [resentTo, setResentTo] = useState<string | null>(null)

  useEffect(() => {
    if (!token || hasStarted.current) {
      return
    }
    hasStarted.current = true
    confirm(token)
  }, [token, confirm])

  if (resentTo) {
    return (
      <CheckYourEmail
        text={messages.resentText}
        values={{ email: resentTo }}
        steps={messages.signUpSteps}
        stepsLabel={messages.signUpStepsLabel}
        resendTo={resentTo}
        logInLabel={messages.logIn}
      />
    )
  }
  return (
    <VerificationMoment
      view={viewOf(token, isSuccess, error)}
      onResent={setResentTo}
      onRetry={() => token && confirm(token)}
    />
  )
}

function viewOf(token: string | null, isSuccess: boolean, error: Error | null): VerificationView {
  if (!token) {
    return { kind: 'linkInvalid' }
  }
  if (isSuccess) {
    return { kind: 'confirmed' }
  }
  if (!error) {
    return { kind: 'confirming' }
  }
  if (error instanceof ApiError && error.code === 'TOO_MANY_ATTEMPTS') {
    return { kind: 'paused', minutes: retryMinutesOf(error) ?? LINK_LIMIT_WINDOW_MINUTES }
  }
  if (error instanceof ApiError && !error.isServerError) {
    return { kind: 'linkInvalid' }
  }
  return {
    kind: 'failed',
    message: errorMessageFor(error),
    isOffline: error instanceof NetworkError,
  }
}
