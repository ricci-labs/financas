import { DISPLAY_NAME_MAX_LENGTH, type NewUserFields, newUserSchema } from '@financas/shared'
import { Link } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import type { OwlSceneName } from '@web/components/brand/owl-scene'
import { Alert } from '@web/components/feedback/alert'
import { OfflineBanner } from '@web/components/feedback/offline-banner'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { PasswordInput } from '@web/components/inputs/password-input'
import { TextInput } from '@web/components/inputs/text-input'
import { AuthLayout } from '@web/components/layout/auth-layout'
import { useSignUp } from '@web/features/auth/api/use-sign-up'
import { authMessages } from '@web/features/auth/auth.messages'
import type { SignUpFormProps, SignUpProblem } from '@web/features/auth/auth.types'
import { useIsOnline } from '@web/hooks/use-is-online'
import { ApiError } from '@web/lib/api/api-error'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { useEffect, useState } from 'react'

const MS_PER_SECOND = 1000
const messages = authMessages.signUp

export function SignUpForm({ onSent, onClosed }: SignUpFormProps) {
  const isOnline = useIsOnline()
  const signUp = useSignUp()
  const [problem, setProblem] = useState<SignUpProblem | null>(null)
  const form = useSchemaForm({
    schema: newUserSchema,
    requiredMessages: messages.required,
    defaultValues: { displayName: '', email: '', password: '' },
  })

  useEffect(() => {
    form.setFocus('displayName')
  }, [form])

  async function signUpWith(newUser: NewUserFields) {
    setProblem(null)
    try {
      await signUp.mutateAsync(newUser)
      onSent(newUser.email)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SIGNUP_DISABLED') {
        onClosed()
        return
      }
      setProblem(problemOf(error))
    }
  }

  const isLimited = problem?.kind === 'limited'

  return (
    <AuthLayout
      scene={sceneOf(isOnline, isLimited)}
      title={messages.title}
      subtitle={messages.subtitle}
      banner={<OfflineBanner />}
      footer={
        <>
          {messages.haveAccount} <TextLink render={<Link to="/login" />}>{messages.logIn}</TextLink>
        </>
      }
    >
      <Form form={form} onSubmit={signUpWith} className="flex flex-col gap-4">
        <FormField
          name="displayName"
          label={messages.name}
          isRequired
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        >
          {(control) => <TextInput autoComplete="name" {...control} />}
        </FormField>
        <FormField name="email" label={messages.email} isRequired>
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
          name="password"
          label={messages.password}
          help={messages.passwordHelp}
          isRequired
        >
          {(control) => <PasswordInput autoComplete="new-password" {...control} />}
        </FormField>
        {problem && (
          <Alert tone={isLimited ? 'warning' : 'danger'} isUrgent>
            {problem.message}
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

function sceneOf(isOnline: boolean, isLimited: boolean): OwlSceneName {
  if (!isOnline) {
    return 'offline'
  }
  return isLimited ? 'wait' : 'signUp'
}

function problemOf(error: unknown): SignUpProblem {
  const message = errorMessageFor(error)
  if (error instanceof ApiError && error.code === 'TOO_MANY_ATTEMPTS') {
    return {
      kind: 'limited',
      message,
      retryAt: Date.now() + (error.retryAfterSeconds ?? 0) * MS_PER_SECOND,
    }
  }
  return { kind: 'unexpected', message }
}
