import type { AlertTone } from '@web/components/feedback/alert'
import type { LOGIN_NOTICES, loginSearchSchema } from '@web/features/auth/auth.schemas'
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
  resendTo?: string
}

export type HandoffResendProps = {
  email: string
}

export type SignUpProblem =
  | { kind: 'limited'; message: string; retryAt: number }
  | { kind: 'unexpected'; message: string }
