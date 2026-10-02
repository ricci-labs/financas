export type StepStatus = 'done' | 'now' | 'next'

export type StepTrackProps = {
  label: string
  steps: readonly string[]
  currentStep: number
  isCurrentLoading?: boolean
}

export type StepProps = {
  label: string
  position: number
  status: StepStatus
  isReached: boolean
  isLoading: boolean
}

export type StepMarkProps = Pick<StepProps, 'status' | 'position' | 'isLoading'>
