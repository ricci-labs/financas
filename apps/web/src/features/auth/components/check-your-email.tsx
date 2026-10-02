import { Link } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import { RichText } from '@web/components/display/rich-text'
import { StepTrack } from '@web/components/display/step-track'
import { Tip } from '@web/components/feedback/tip'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'
import type { CheckYourEmailProps } from '@web/features/auth/auth.types'
import { HandoffResendButton } from '@web/features/auth/components/handoff-resend-button'

const HANDOFF_STEP = 1
const messages = authMessages.checkEmail

export function CheckYourEmail({ text, values, steps, stepsLabel, resendTo }: CheckYourEmailProps) {
  return (
    <MomentScreen
      tone="celebrate"
      scene="envelope"
      title={messages.title}
      actions={
        <>
          <p className="text-body-sm">{messages.canClose}</p>
          <Tip>{messages.tip}</Tip>
          {resendTo && <HandoffResendButton email={resendTo} />}
          <p className="text-body-sm">
            {messages.alreadyConfirmed}{' '}
            <TextLink tone="inherit" render={<Link to="/login" />}>
              {messages.backToLogIn}
            </TextLink>
          </p>
        </>
      }
    >
      <p>
        <RichText text={text} values={values} />
      </p>
      <StepTrack label={stepsLabel} steps={steps} currentStep={HANDOFF_STEP} />
    </MomentScreen>
  )
}
