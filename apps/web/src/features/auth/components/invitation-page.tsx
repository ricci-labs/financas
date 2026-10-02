import { useNavigate } from '@tanstack/react-router'
import { useAcceptInvitation } from '@web/features/auth/api/use-accept-invitation'
import { usePreviewInvitation } from '@web/features/auth/api/use-preview-invitation'
import { useSignedInAccount } from '@web/features/auth/api/use-signed-in-account'
import { authMessages } from '@web/features/auth/auth.messages'
import type { InvitationFlowProps, InvitationStep } from '@web/features/auth/auth.types'
import { AppOpening } from '@web/features/auth/components/app-opening'
import { InvalidInvitation } from '@web/features/auth/components/invalid-invitation'
import { InvitationMoment } from '@web/features/auth/components/invitation-moment'
import { InvitationSignUpForm } from '@web/features/auth/components/invitation-sign-up-form'
import { invitationViewOf } from '@web/features/auth/components/invitation-view'
import { useArrivalState } from '@web/hooks/use-arrival-state'
import { useCallOnce } from '@web/hooks/use-call-once'
import { useLinkToken } from '@web/hooks/use-link-token'
import { usePageTitle } from '@web/hooks/use-page-title'
import { useEffect, useState } from 'react'

const JOINED_PAUSE_MS = 1500

export function InvitationPage() {
  usePageTitle(authMessages.invitation.pageTitle)
  const linkToken = useLinkToken()
  const { inviteToken } = useArrivalState()
  const token = linkToken ?? inviteToken
  return token ? (
    <InvitationFlow token={token} />
  ) : (
    <InvalidInvitation code="INVITATION_NOT_FOUND" />
  )
}

function InvitationFlow({ token }: InvitationFlowProps) {
  const account = useSignedInAccount()
  const preview = usePreviewInvitation()
  const accept = useAcceptInvitation()
  const [step, setStep] = useState<InvitationStep>('preview')
  const [signUpRefusal, setSignUpRefusal] = useState<unknown>(null)
  useCallOnce(token, preview.mutate)
  useOpenWorkspaceOnceJoined(accept.isSuccess)

  const view = invitationViewOf({
    invitation: preview.data,
    previewError: preview.error,
    isAccepted: accept.isSuccess,
    refusal: accept.error ?? signUpRefusal,
    step,
  })

  if (view.kind === 'opening') {
    return <AppOpening />
  }
  if (view.kind === 'creatingAccount') {
    return (
      <InvitationSignUpForm
        token={token}
        invitation={view.invitation}
        onAwaitingConfirmation={() => setStep('awaitingConfirmation')}
        onRefused={setSignUpRefusal}
      />
    )
  }
  return (
    <InvitationMoment
      view={view}
      token={token}
      account={account}
      isAccepting={accept.isPending}
      onAccept={() => accept.mutate(token)}
      onRetry={() => preview.mutate(token)}
      onCreateAccount={() => setStep('createAccount')}
    />
  )
}

function useOpenWorkspaceOnceJoined(isJoined: boolean) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isJoined) {
      return
    }
    const timer = setTimeout(() => void navigate({ to: '/' }), JOINED_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [isJoined, navigate])
}
