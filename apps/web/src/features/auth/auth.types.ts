import type { ButtonProps } from '@web/components/actions/button'
import type { AlertTone } from '@web/components/feedback/alert'
import type { LOGIN_NOTICES, loginSearchSchema } from '@web/features/auth/auth.schemas'
import type { ReactNode } from 'react'
import type { z } from 'zod'

export type LoginNotice = (typeof LOGIN_NOTICES)[number]

export type LoginSearch = z.infer<typeof loginSearchSchema>

export type LoginPageProps = {
  next?: string
  notice?: LoginNotice
}

export type LoginProblem =
  | { kind: 'credentials'; message: string }
  | { kind: 'unverified'; message: string; email: string }
  | { kind: 'limited'; message: string; retryAt: number }
  | { kind: 'unexpected'; message: string }

export type ArrivalNotice = {
  tone: AlertTone
  message: string
}

export type ResendVerificationProps = {
  email: string
}

export type SignUpFormProps = {
  onSent: (email: string) => void
  onClosed: () => void
}

export type CheckYourEmailProps = {
  text: string
  values: Readonly<Record<string, string>>
  steps: readonly string[]
  stepsLabel: string
  actions: ReactNode
}

export type ConfirmationHandoffActionsProps = {
  email: string
  logInLabel: string
}

export type ForgotPasswordFormProps = {
  email?: string
  onSent: (email: string) => void
}

export type HandoffResendProps = {
  email: string
}

export type FormProblem =
  | { kind: 'limited'; message: string; retryAt: number }
  | { kind: 'unexpected'; message: string }

export type ResendConfirmationFormProps = {
  onSent: (email: string) => void
}

export type VerificationView =
  | { kind: 'confirming' }
  | { kind: 'confirmed' }
  | { kind: 'linkInvalid' }
  | { kind: 'paused'; minutes: number }
  | { kind: 'failed'; message: string; isOffline: boolean }

export type VerificationMomentProps = {
  view: VerificationView
  onResent: (email: string) => void
  onRetry: () => void
}

export type SignUpStepsProps = {
  currentStep: number
  isCurrentLoading?: boolean
}

export type LogInButtonProps = {
  variant?: ButtonProps['variant']
  children: string
}
