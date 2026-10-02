import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { Divider } from '@web/components/display/divider'
import { NextStepCard } from '@web/components/display/next-step-card'
import { StepTrack } from '@web/components/display/step-track'
import { Alert } from '@web/components/feedback/alert'
import { OfflineBanner } from '@web/components/feedback/offline-banner'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'
import type {
  LogInButtonProps,
  SignUpStepsProps,
  VerificationMomentProps,
} from '@web/features/auth/auth.types'
import { ResendConfirmationForm } from '@web/features/auth/components/resend-confirmation-form'
import { ArrowRight } from 'lucide-react'

const VERIFY_STEP = 1
const LOG_IN_STEP = 2
const messages = authMessages.verifyEmail

export function VerificationMoment({ view, onResent, onRetry }: VerificationMomentProps) {
  switch (view.kind) {
    case 'confirming':
      return (
        <MomentScreen
          tone="celebrate"
          scene="wait"
          title={messages.confirming.title}
          banner={<OfflineBanner />}
          actions={<p className="text-body-sm">{messages.confirming.stayHere}</p>}
        >
          <p>{messages.confirming.text}</p>
          <SignUpSteps currentStep={VERIFY_STEP} isCurrentLoading />
        </MomentScreen>
      )
    case 'confirmed':
      return (
        <MomentScreen
          tone="celebrate"
          scene="confirmed"
          title={messages.confirmed.title}
          actions={
            <>
              <NextStepCard>{messages.confirmed.next}</NextStepCard>
              <Button
                width="full"
                render={<Link to="/login" search={{ notice: 'email-verified' }} />}
              >
                {messages.confirmed.logIn}
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          }
        >
          <p>{messages.confirmed.text}</p>
          <SignUpSteps currentStep={LOG_IN_STEP} />
        </MomentScreen>
      )
    case 'linkInvalid':
      return (
        <MomentScreen
          tone="calm"
          scene="linkExpired"
          title={messages.linkInvalid.title}
          actions={
            <>
              <LogInButton>{messages.linkInvalid.logIn}</LogInButton>
              <Divider surface="paper">{messages.linkInvalid.notConfirmed}</Divider>
              <ResendConfirmationForm onSent={onResent} />
            </>
          }
        >
          <p>{messages.linkInvalid.text}</p>
        </MomentScreen>
      )
    case 'paused':
      return (
        <MomentScreen
          tone="calm"
          scene="wait"
          title={messages.paused.title}
          actions={<LogInButton>{messages.paused.logIn}</LogInButton>}
        >
          <p>{messages.paused.text(view.minutes)}</p>
        </MomentScreen>
      )
    case 'failed':
      return (
        <MomentScreen
          tone="celebrate"
          scene={view.isOffline ? 'offline' : 'wait'}
          title={messages.confirming.title}
          banner={<OfflineBanner />}
          actions={
            <>
              <Alert tone="danger" isUrgent>
                {view.message}
              </Alert>
              <Button width="full" onClick={onRetry}>
                {messages.retry}
              </Button>
            </>
          }
        >
          <p>{messages.confirming.text}</p>
          <SignUpSteps currentStep={VERIFY_STEP} />
        </MomentScreen>
      )
  }
}

function SignUpSteps({ currentStep, isCurrentLoading }: SignUpStepsProps) {
  return (
    <StepTrack
      label={messages.stepsLabel}
      steps={messages.steps}
      currentStep={currentStep}
      isCurrentLoading={isCurrentLoading}
    />
  )
}

function LogInButton({ children }: LogInButtonProps) {
  return (
    <Button width="full" render={<Link to="/login" />}>
      {children}
    </Button>
  )
}
