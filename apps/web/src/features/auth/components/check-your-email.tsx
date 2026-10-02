import { RichText } from '@web/components/display/rich-text'
import { StepTrack } from '@web/components/display/step-track'
import { Tip } from '@web/components/feedback/tip'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { authMessages } from '@web/features/auth/auth.messages'
import type { CheckYourEmailProps } from '@web/features/auth/auth.types'

const HANDOFF_STEP = 1
const messages = authMessages.checkEmail

export function CheckYourEmail({ text, values, steps, stepsLabel, actions }: CheckYourEmailProps) {
  return (
    <MomentScreen
      tone="celebrate"
      scene="envelope"
      title={messages.title}
      actions={
        <>
          <p className="text-body-sm">{messages.canClose}</p>
          <Tip>{messages.tip}</Tip>
          {actions}
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
