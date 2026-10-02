import type {
  StepProps,
  StepStatus,
  StepTrackProps,
} from '@web/components/display/step-track/step-track.types'
import {
  stepDotVariants,
  stepLineVariants,
  stepTrackVariants,
  stepVariants,
} from '@web/components/display/step-track/step-track.variants'
import { Spinner } from '@web/components/feedback/spinner'
import { Check } from 'lucide-react'

export function StepTrack({ label, steps, currentStep, isCurrentLoading = false }: StepTrackProps) {
  return (
    <ol data-slot="step-track" aria-label={label} className={stepTrackVariants()}>
      {steps.map((stepLabel, index) => (
        <Step
          key={stepLabel}
          label={stepLabel}
          position={index + 1}
          status={statusOf(index, currentStep)}
          isReached={index <= currentStep}
          isLoading={index === currentStep && isCurrentLoading}
        />
      ))}
    </ol>
  )
}

function Step({ label, position, status, isReached, isLoading }: StepProps) {
  return (
    <li className={stepVariants({ status })} aria-current={status === 'now' ? 'step' : undefined}>
      {position > 1 && <span aria-hidden="true" className={stepLineVariants({ isReached })} />}
      <span aria-hidden="true" className={stepDotVariants({ status })}>
        <StepMark status={status} position={position} isLoading={isLoading} />
      </span>
      {label}
    </li>
  )
}

function StepMark({
  status,
  position,
  isLoading,
}: Pick<StepProps, 'status' | 'position' | 'isLoading'>) {
  if (status === 'done') {
    return <Check />
  }
  if (isLoading) {
    return <Spinner size="sm" />
  }
  return position
}

function statusOf(index: number, currentStep: number): StepStatus {
  if (index < currentStep) {
    return 'done'
  }
  return index === currentStep ? 'now' : 'next'
}
