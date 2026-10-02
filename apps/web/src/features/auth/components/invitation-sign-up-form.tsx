import { DISPLAY_NAME_MAX_LENGTH, type NewUserFields, newUserSchema } from '@financas/shared'
import { Link, useNavigate } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import { RichText } from '@web/components/display/rich-text'
import { Alert } from '@web/components/feedback/alert'
import { OfflineBanner } from '@web/components/feedback/offline-banner'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { PasswordInput } from '@web/components/inputs/password-input'
import { TextInput } from '@web/components/inputs/text-input'
import { AuthLayout } from '@web/components/layout/auth-layout'
import { useSignUpThroughInvitation } from '@web/features/auth/api/use-sign-up-through-invitation'
import { authMessages } from '@web/features/auth/auth.messages'
import type {
  InvitationSignUpFormProps,
  InvitationSignUpProblem,
} from '@web/features/auth/auth.types'
import { formProblemOf } from '@web/features/auth/components/form-problem'
import { useIsOnline } from '@web/hooks/use-is-online'
import { ApiError } from '@web/lib/api/api-error'
import { fill } from '@web/lib/format/template'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { useEffect, useState } from 'react'

const INVITE_PATH = '/invite'
const messages = authMessages.invitation.signUp

export function InvitationSignUpForm({
  token,
  invitation,
  onAwaitingConfirmation,
  onRefused,
}: InvitationSignUpFormProps) {
  const navigate = useNavigate()
  const isOnline = useIsOnline()
  const signUp = useSignUpThroughInvitation()
  const [problem, setProblem] = useState<InvitationSignUpProblem | null>(null)
  const invitedEmail = invitation.email
  const form = useSchemaForm({
    schema: newUserSchema,
    requiredMessages: messages.required,
    defaultValues: { email: invitedEmail ?? '', displayName: '', password: '' },
  })

  useEffect(() => {
    form.setFocus(invitedEmail ? 'displayName' : 'email')
  }, [form, invitedEmail])

  async function createAccount({ email, displayName, password }: NewUserFields) {
    setProblem(null)
    try {
      const joined = await signUp.mutateAsync({
        token,
        displayName,
        password,
        email: invitedEmail ? undefined : email,
      })
      if (!joined.isEmailVerified) {
        onAwaitingConfirmation()
        return
      }
      await navigate({
        to: '/login',
        state: { email, joinedWorkspaceName: invitation.workspaceName },
      })
    } catch (error) {
      handleRefusal(error)
    }
  }

  function handleRefusal(error: unknown) {
    const code = error instanceof ApiError ? error.code : ''
    if (code === 'EMAIL_TAKEN') {
      setProblem({ kind: 'emailTaken', message: messages.emailTaken })
      return
    }
    if (code in authMessages.invitation.invalid) {
      onRefused(error)
      return
    }
    setProblem(formProblemOf(error))
  }

  const isLimited = problem?.kind === 'limited'
  const logInAndReturn = (
    <Link
      to="/login"
      search={{ next: INVITE_PATH }}
      state={{ inviteToken: token, email: form.getValues('email') }}
    />
  )

  return (
    <AuthLayout
      scene={isLimited ? 'wait' : 'invitation'}
      title={messages.title}
      subtitle={fill(messages.subtitle, {
        workspaceName: invitation.workspaceName,
        inviterName: invitation.inviterName,
      })}
      banner={<OfflineBanner />}
      footer={
        <>
          {messages.haveAccount} <TextLink render={logInAndReturn}>{messages.logIn}</TextLink>
        </>
      }
    >
      <Form form={form} onSubmit={createAccount} className="flex flex-col gap-4">
        <FormField
          name="email"
          label={messages.email}
          help={invitedEmail ? messages.emailLocked : undefined}
          isRequired
          isReadOnly={Boolean(invitedEmail)}
        >
          {(control) => (
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={messages.emailPlaceholder}
              {...control}
            />
          )}
        </FormField>
        <FormField
          name="displayName"
          label={messages.name}
          isRequired
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        >
          {(control) => <TextInput autoComplete="name" {...control} />}
        </FormField>
        <FormField
          name="password"
          label={messages.password}
          help={messages.passwordHelp}
          isRequired
        >
          {(control) => <PasswordInput autoComplete="new-password" {...control} />}
        </FormField>
        {problem && (
          <Alert tone={isLimited ? 'warning' : 'danger'} isUrgent>
            <RichText
              text={problem.message}
              link={(label) => (
                <TextLink tone="inherit" render={logInAndReturn}>
                  {label}
                </TextLink>
              )}
            />
          </Alert>
        )}
        <SubmitButton
          width="full"
          loadingLabel={messages.submitting}
          isBlocked={!isOnline}
          waitUntil={isLimited ? problem.retryAt : null}
          waitLabel={messages.retryIn}
        >
          {messages.submit}
        </SubmitButton>
      </Form>
    </AuthLayout>
  )
}
