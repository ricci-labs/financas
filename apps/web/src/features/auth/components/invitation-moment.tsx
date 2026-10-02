import { Link } from '@tanstack/react-router'
import { Button } from '@web/components/actions/button'
import { TextLink } from '@web/components/actions/text-link'
import { RichText } from '@web/components/display/rich-text'
import { StepTrack } from '@web/components/display/step-track'
import { Alert } from '@web/components/feedback/alert'
import { Spinner } from '@web/components/feedback/spinner'
import { MomentScreen } from '@web/components/layout/moment-screen'
import { useLogOut } from '@web/features/auth/api/use-log-out'
import { authMessages } from '@web/features/auth/auth.messages'
import type { InvitationMomentProps, InvitationSummaryProps } from '@web/features/auth/auth.types'
import { GoToLogIn, InvalidInvitation } from '@web/features/auth/components/invalid-invitation'
import { SignedInLine } from '@web/features/auth/components/signed-in-line'
import { formatDay } from '@web/lib/format/date'

const INVITE_PATH = '/invite'
const CONFIRM_STEP = 1
const messages = authMessages.invitation
const signUpSteps = authMessages.checkEmail

export function InvitationMoment(props: InvitationMomentProps) {
  const { view, token, account, isAccepting, onAccept, onRetry, onCreateAccount } = props
  const logOut = useLogOut()
  const logOutAndReturn = () => logOut.mutate({ next: INVITE_PATH, inviteToken: token })

  switch (view.kind) {
    case 'invited':
      return (
        <MomentScreen
          tone="celebrate"
          scene="invitation"
          title={messages.title(view.invitation.inviterName)}
          actions={
            account ? (
              <>
                {view.problem && (
                  <Alert tone="danger" isUrgent>
                    {view.problem}
                  </Alert>
                )}
                <Button
                  width="full"
                  isLoading={isAccepting}
                  loadingLabel={messages.entering}
                  onClick={onAccept}
                >
                  {messages.enter}
                </Button>
                <SignedInLine
                  account={account}
                  action={
                    <TextLink
                      tone="inherit"
                      render={<button type="button" />}
                      onClick={logOutAndReturn}
                    >
                      {messages.notYou}
                    </TextLink>
                  }
                />
              </>
            ) : (
              <>
                <Button width="full" onClick={onCreateAccount}>
                  {messages.createAccount}
                </Button>
                <Button
                  variant="outline"
                  width="full"
                  render={
                    <Link
                      to="/login"
                      search={{ next: INVITE_PATH }}
                      state={{ inviteToken: token }}
                    />
                  }
                >
                  {messages.haveAccount}
                </Button>
              </>
            )
          }
        >
          <InvitationSummary invitation={view.invitation} />
        </MomentScreen>
      )
    case 'joined':
      return (
        <MomentScreen
          tone="celebrate"
          scene="together"
          title={messages.joined.title(view.invitation.workspaceName)}
          actions={
            <p className="flex items-center justify-center gap-2 text-body-sm">
              <Spinner />
              {messages.joined.opening}
            </p>
          }
        >
          <p>{messages.joined.text}</p>
        </MomentScreen>
      )
    case 'alreadyMember':
      return (
        <MomentScreen
          tone="celebrate"
          scene="together"
          title={messages.alreadyMember.title}
          actions={
            <Button width="full" render={<Link to="/" />}>
              {messages.alreadyMember.open}
            </Button>
          }
        >
          <p>
            <RichText
              text={messages.alreadyMember.text}
              values={{
                inviterName: view.invitation.inviterName,
                workspaceName: view.invitation.workspaceName,
              }}
            />
          </p>
        </MomentScreen>
      )
    case 'anotherEmail':
      return (
        <MomentScreen
          tone="calm"
          scene="invitation"
          title={messages.anotherEmail.title}
          actions={
            <>
              <Button width="full" isLoading={logOut.isPending} onClick={logOutAndReturn}>
                {messages.anotherEmail.switch}
              </Button>
              {account && <SignedInLine account={account} />}
            </>
          }
        >
          <p>
            <RichText
              text={messages.anotherEmail.text}
              values={{ email: view.invitation.email ?? '' }}
            />
          </p>
        </MomentScreen>
      )
    case 'awaitingConfirmation':
      return (
        <MomentScreen
          tone="celebrate"
          scene="envelope"
          title={messages.awaitingConfirmation.title}
          actions={
            <>
              <p className="text-body-sm">{signUpSteps.canClose}</p>
              <p className="text-body-sm">
                {signUpSteps.alreadyConfirmed}{' '}
                <TextLink tone="inherit" render={<Link to="/login" />}>
                  {signUpSteps.logIn}
                </TextLink>
              </p>
            </>
          }
        >
          <p>
            <RichText
              text={messages.awaitingConfirmation.text}
              values={{ workspaceName: view.invitation.workspaceName }}
            />
          </p>
          <StepTrack
            label={signUpSteps.signUpStepsLabel}
            steps={signUpSteps.signUpSteps}
            currentStep={CONFIRM_STEP}
          />
        </MomentScreen>
      )
    case 'invalid':
      return <InvalidInvitation code={view.code} />
    case 'paused':
      return (
        <MomentScreen tone="calm" scene="wait" title={messages.paused} actions={<GoToLogIn />}>
          <p>{view.message}</p>
        </MomentScreen>
      )
    case 'failed':
      return (
        <MomentScreen
          tone="calm"
          scene={view.isOffline ? 'offline' : 'wait'}
          title={messages.failed.title}
          actions={
            <Button width="full" onClick={onRetry}>
              {messages.failed.retry}
            </Button>
          }
        >
          <p>{view.message}</p>
        </MomentScreen>
      )
  }
}

function InvitationSummary({ invitation }: InvitationSummaryProps) {
  const date = formatDay(invitation.expiresAt)
  return (
    <>
      <p>
        <RichText
          text={messages.text}
          values={{ workspaceName: invitation.workspaceName, roleName: invitation.roleName }}
        />
      </p>
      <p className="text-body-sm">
        {invitation.email ? (
          <RichText text={messages.forEmail} values={{ email: invitation.email, date }} />
        ) : (
          <RichText text={messages.validUntil} values={{ date }} />
        )}
      </p>
    </>
  )
}
