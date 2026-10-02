import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { authMessages } from '@web/features/auth/auth.messages'
import { CheckYourEmail } from '@web/features/auth/components/check-your-email'
import { ForgotPasswordForm } from '@web/features/auth/components/forgot-password-form'
import { useArrivalState } from '@web/hooks/use-arrival-state'
import { usePageTitle } from '@web/hooks/use-page-title'
import { useState } from 'react'

const messages = authMessages.checkEmail

export function ForgotPasswordPage() {
  usePageTitle(authMessages.forgotPassword.pageTitle)
  const { email: arrivalEmail } = useArrivalState()
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo) {
    return (
      <CheckYourEmail
        text={messages.forgotPasswordText}
        values={{ email: sentTo }}
        steps={messages.forgotPasswordSteps}
        stepsLabel={messages.forgotPasswordStepsLabel}
        kit="forgot-sent"
        actions={
          <Button variant="outline" width="full" render={<Link to="/login" />}>
            {messages.backToLogIn}
          </Button>
        }
      />
    )
  }
  return <ForgotPasswordForm email={arrivalEmail} onSent={setSentTo} />
}
