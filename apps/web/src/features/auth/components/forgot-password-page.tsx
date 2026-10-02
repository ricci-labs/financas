import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { authMessages } from '@web/features/auth/auth.messages'
import { CheckYourEmail } from '@web/features/auth/components/check-your-email'
import { ForgotPasswordForm } from '@web/features/auth/components/forgot-password-form'
import { useArrivalEmail } from '@web/hooks/use-arrival-email'
import { useState } from 'react'

const messages = authMessages.checkEmail

export function ForgotPasswordPage() {
  const arrivalEmail = useArrivalEmail()
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo) {
    return (
      <CheckYourEmail
        text={messages.forgotPasswordText}
        values={{ email: sentTo }}
        steps={messages.forgotPasswordSteps}
        stepsLabel={messages.forgotPasswordStepsLabel}
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
