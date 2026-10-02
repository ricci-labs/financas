import { useSuspenseQuery } from '@tanstack/react-query'
import { authConfigQueryOptions } from '@web/features/auth/api/auth.queries'
import { authMessages } from '@web/features/auth/auth.messages'
import { CheckYourEmail } from '@web/features/auth/components/check-your-email'
import { ConfirmationHandoffActions } from '@web/features/auth/components/confirmation-handoff-actions'
import { SignUpClosed } from '@web/features/auth/components/sign-up-closed'
import { SignUpForm } from '@web/features/auth/components/sign-up-form'
import { usePageTitle } from '@web/hooks/use-page-title'
import { useState } from 'react'

const messages = authMessages.checkEmail

export function SignUpPage() {
  usePageTitle(authMessages.signUp.pageTitle)
  const { data: config } = useSuspenseQuery(authConfigQueryOptions())
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isClosed, setIsClosed] = useState(false)

  if (!config.isSignupEnabled || isClosed) {
    return <SignUpClosed />
  }
  if (sentTo) {
    return (
      <CheckYourEmail
        text={messages.signUpText}
        values={{ email: sentTo }}
        steps={messages.signUpSteps}
        stepsLabel={messages.signUpStepsLabel}
        kit="sign-up-sent"
        actions={<ConfirmationHandoffActions email={sentTo} logInLabel={messages.backToLogIn} />}
      />
    )
  }
  return <SignUpForm onSent={setSentTo} onClosed={() => setIsClosed(true)} />
}
