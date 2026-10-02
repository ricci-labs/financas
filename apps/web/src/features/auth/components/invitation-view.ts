import { authMessages } from '@web/features/auth/auth.messages'
import type {
  InvalidInvitationCode,
  InvitationPreview,
  InvitationView,
  InvitationViewInput,
} from '@web/features/auth/auth.types'
import { ApiError, NetworkError } from '@web/lib/api/api-error'
import { errorMessageFor } from '@web/lib/errors/error-message'

const NOT_FOUND: InvalidInvitationCode = 'INVITATION_NOT_FOUND'

export function invitationViewOf(input: InvitationViewInput): InvitationView {
  const { invitation, previewError, isAccepted, refusal, step } = input
  if (previewError) {
    return blockedViewOf(previewError) ?? failedViewOf(previewError)
  }
  if (!invitation) {
    return { kind: 'opening' }
  }
  if (isAccepted) {
    return { kind: 'joined', invitation }
  }
  if (refusal) {
    return refusedViewOf(refusal, invitation)
  }
  if (step === 'createAccount') {
    return { kind: 'creatingAccount', invitation }
  }
  if (step === 'awaitingConfirmation') {
    return { kind: 'awaitingConfirmation', invitation }
  }
  return { kind: 'invited', invitation, problem: null }
}

function refusedViewOf(refusal: unknown, invitation: InvitationPreview): InvitationView {
  const code = refusal instanceof ApiError ? refusal.code : null
  if (code === 'ALREADY_MEMBER') {
    return { kind: 'alreadyMember', invitation }
  }
  if (code === 'INVITATION_FOR_ANOTHER_EMAIL') {
    return { kind: 'anotherEmail', invitation }
  }
  return (
    blockedViewOf(refusal) ?? { kind: 'invited', invitation, problem: errorMessageFor(refusal) }
  )
}

function blockedViewOf(error: unknown): InvitationView | null {
  if (!(error instanceof ApiError)) {
    return null
  }
  if (error.code === 'TOO_MANY_ATTEMPTS') {
    return { kind: 'paused', message: errorMessageFor(error) }
  }
  if (isInvalidCode(error.code)) {
    return { kind: 'invalid', code: error.code }
  }
  return null
}

function failedViewOf(error: unknown): InvitationView {
  if (error instanceof ApiError && !error.isServerError) {
    return { kind: 'invalid', code: NOT_FOUND }
  }
  return {
    kind: 'failed',
    message: errorMessageFor(error),
    isOffline: error instanceof NetworkError,
  }
}

function isInvalidCode(code: string): code is InvalidInvitationCode {
  return code in authMessages.invitation.invalid
}
