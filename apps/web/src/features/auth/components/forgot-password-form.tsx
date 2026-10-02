import { emailRequestSchema } from '@financas/shared'
import { Link } from '@tanstack/react-router'
import { TextLink } from '@web/components/actions/text-link'
import type { OwlSceneName } from '@web/components/brand/owl-scene'
import { Alert } from '@web/components/feedback/alert'
import { OfflineBanner } from '@web/components/feedback/offline-banner'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { TextInput } from '@web/components/inputs/text-input'
import { AuthLayout } from '@web/components/layout/auth-layout'
import { useRequestPasswordReset } from '@web/features/auth/api/use-request-password-reset'
import { authMessages } from '@web/features/auth/auth.messages'
import type { ForgotPasswordFormProps, FormProblem } from '@web/features/auth/auth.types'
import { formProblemOf } from '@web/features/auth/components/form-problem'
import { useIsOnline } from '@web/hooks/use-is-online'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { useEffect, useState } from 'react'

const messages = authMessages.forgotPassword

export function ForgotPasswordForm({ email = '', onSent }: ForgotPasswordFormProps) {
  const isOnline = useIsOnline()
  const requestReset = useRequestPasswordReset()
  const [problem, setProblem] = useState<FormProblem | null>(null)
  const form = useSchemaForm({
    schema: emailRequestSchema,
    requiredMessages: messages.required,
    defaultValues: { email },
  })

  useEffect(() => {
    form.setFocus('email')
  }, [form])

  async function requestFor(request: { email: string }) {
    setProblem(null)
    try {
      await requestReset.mutateAsync(request.email)
      onSent(request.email)
    } catch (error) {
      setProblem(formProblemOf(error))
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
          {messages.remembered}{' '}
          <TextLink render={<Link to="/login" />}>{messages.backToLogIn}</TextLink>
        </>
      }
    >
      <Form form={form} onSubmit={requestFor} className="flex flex-col gap-4">
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
