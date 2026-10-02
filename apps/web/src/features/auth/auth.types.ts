import type { OwlKitName } from '@web/components/brand/owl-kit'
import type { AlertTone } from '@web/components/feedback/alert'
import type { previewInvitation } from '@web/features/auth/api/use-preview-invitation'
import type { useSignedInAccount } from '@web/features/auth/api/use-signed-in-account'
import type { authMessages } from '@web/features/auth/auth.messages'
import type {
  LOGIN_NOTICES,
  loginSearchSchema,
  newPasswordSchema,
} from '@web/features/auth/auth.schemas'
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
  kit?: OwlKitName
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
  | { kind: 'linkInvalid'; wasChecked: boolean }
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
  children: string
}

export type NewPasswordFields = z.output<typeof newPasswordSchema>

export type ResetPasswordFormProps = {
  token: string
  onLinkInvalid: () => void
}

export type LogOutReturn = {
  next: string
  inviteToken: string
}

export type InvitationPreview = Awaited<ReturnType<typeof previewInvitation>>

export type SignedInAccount = NonNullable<ReturnType<typeof useSignedInAccount>>

export type InvalidInvitationCode = keyof typeof authMessages.invitation.invalid

export type InvitationView =
  | { kind: 'opening' }
  | { kind: 'invalid'; code: InvalidInvitationCode }
  | { kind: 'paused'; message: string }
  | { kind: 'failed'; message: string; isOffline: boolean }
  | { kind: 'invited'; invitation: InvitationPreview; problem: string | null }
  | { kind: 'creatingAccount'; invitation: InvitationPreview }
  | { kind: 'awaitingConfirmation'; invitation: InvitationPreview }
  | { kind: 'joined'; invitation: InvitationPreview }
  | { kind: 'alreadyMember'; invitation: InvitationPreview }
  | { kind: 'anotherEmail'; invitation: InvitationPreview }

export type InvitationViewInput = {
  invitation: InvitationPreview | undefined
  previewError: Error | null
  isAccepted: boolean
  refusal: unknown
  step: InvitationStep
}

export type InvitationStep = 'preview' | 'createAccount' | 'awaitingConfirmation'

export type InvitationMomentProps = {
  view: Exclude<InvitationView, { kind: 'opening' } | { kind: 'creatingAccount' }>
  token: string
  account: SignedInAccount | null
  isAccepting: boolean
  onAccept: () => void
  onRetry: () => void
  onCreateAccount: () => void
}

export type InvitationSignUpFormProps = {
  token: string
  invitation: InvitationPreview
  onAwaitingConfirmation: () => void
  onRefused: (error: unknown) => void
}

export type InvitationSignUpProblem = FormProblem | { kind: 'emailTaken'; message: string }

export type SignedInLineProps = {
  account: SignedInAccount
  action?: ReactNode
}

export type InvitationSummaryProps = {
  invitation: InvitationPreview
}

export type InvitationFlowProps = {
  token: string
}

export type InvalidInvitationProps = {
  code: InvalidInvitationCode
}

export type PasswordLinkInvalidProps = {
  wasTried: boolean
}
