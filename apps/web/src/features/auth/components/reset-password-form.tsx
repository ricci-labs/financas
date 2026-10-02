import { Link, useNavigate } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import type { OwlSceneName } from '@web/components/brand/owl-scene'
import { Alert } from '@web/components/feedback/alert'
import { OfflineBanner } from '@web/components/feedback/offline-banner'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { PasswordInput } from '@web/components/inputs/password-input'
import { AuthLayout } from '@web/components/layout/auth-layout'
import { useResetPassword } from '@web/features/auth/api/use-reset-password'
import { authMessages } from '@web/features/auth/auth.messages'
import { newPasswordSchema } from '@web/features/auth/auth.schemas'
import type {
  FormProblem,
  NewPasswordFields,
  ResetPasswordFormProps,
} from '@web/features/auth/auth.types'
import { formProblemOf } from '@web/features/auth/components/form-problem'
import { useIsOnline } from '@web/hooks/use-is-online'
import { ApiError } from '@web/lib/api/api-error'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { useEffect, useState } from 'react'

const messages = authMessages.resetPassword

export function ResetPasswordForm({ token, onLinkInvalid }: ResetPasswordFormProps) {
  const navigate = useNavigate()
  const isOnline = useIsOnline()
  const resetPassword = useResetPassword()
  const [problem, setProblem] = useState<FormProblem | null>(null)
  const form = useSchemaForm({
    schema: newPasswordSchema,
    requiredMessages: messages.required,
    defaultValues: { password: '', confirmation: '' },
  })

  useEffect(() => {
    form.setFocus('password')
  }, [form])

  async function changeTo({ password }: NewPasswordFields) {
    setProblem(null)
    try {
      await resetPassword.mutateAsync({ token, password })
      await navigate({ to: '/login', search: { notice: 'password-changed' } })
    } catch (error) {
      handleRefusal(error)
    }
  }

  function handleRefusal(error: unknown) {
    const code = error instanceof ApiError ? error.code : null
    if (code === 'LINK_INVALID') {
      onLinkInvalid()
      return
    }
    if (code === 'PASSWORD_INVALID') {
      form.setError('password', { message: errorMessageFor(error) }, { shouldFocus: true })
      return
    }
    setProblem(formProblemOf(error))
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
          {messages.remembered}{' '}
          <TextLink render={<Link to="/login" />}>{messages.backToLogIn}</TextLink>
        </>
      }
    >
      <Form form={form} onSubmit={changeTo} className="flex flex-col gap-4">
        <FormField
          name="password"
          label={messages.password}
          help={messages.passwordHelp}
          isRequired
        >
          {(control) => <PasswordInput autoComplete="new-password" {...control} />}
        </FormField>
        <FormField name="confirmation" label={messages.confirmation} isRequired>
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
  return isLimited ? 'wait' : 'key'
}
