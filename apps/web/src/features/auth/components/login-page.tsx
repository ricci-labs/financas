import { credentialsSchema } from '@financas/shared'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
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
import { authConfigQueryOptions } from '@web/features/auth/api/auth.queries'
import { useLogIn } from '@web/features/auth/api/use-log-in'
import { authMessages } from '@web/features/auth/auth.messages'
import type { LoginPageProps, LoginProblem } from '@web/features/auth/auth.types'
import { arrivalNoticeOf } from '@web/features/auth/components/arrival-notice'
import { ResendVerificationButton } from '@web/features/auth/components/resend-verification-button'
import { useIsOnline } from '@web/hooks/use-is-online'
import { ApiError } from '@web/lib/api/api-error'
import { errorMessageFor } from '@web/lib/errors/error-message'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { appPathOrHome } from '@web/lib/navigation'
import { useEffect, useState } from 'react'
import { useWatch } from 'react-hook-form'

const MS_PER_SECOND = 1000
const messages = authMessages.login

export function LoginPage({ next, notice }: LoginPageProps) {
  const navigate = useNavigate()
  const isOnline = useIsOnline()
  const logIn = useLogIn()
  const config = useQuery(authConfigQueryOptions())
  const [problem, setProblem] = useState<LoginProblem | null>(null)
  const form = useSchemaForm({
    schema: credentialsSchema,
    requiredMessages: messages.required,
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    form.setFocus('email')
  }, [form])

  async function logInWith(credentials: { email: string; password: string }) {
    setProblem(null)
    try {
      await logIn.mutateAsync(credentials)
      await navigate({ href: appPathOrHome(next) })
    } catch (error) {
      const found = problemOf(error, credentials.email)
      setProblem(found)
      if (found.kind === 'credentials') {
        form.resetField('password')
        form.setFocus('password')
      }
    }
  }

  const typedEmail = useWatch({ control: form.control, name: 'email' }).trim()
  const isLimited = problem?.kind === 'limited'
  const topNotice =
    problem?.kind === 'unverified' ? (
      <Alert tone="warning" isUrgent action={<ResendVerificationButton email={problem.email} />}>
        {problem.message}
      </Alert>
    ) : (
      arrivalNoticeOf(notice)
    )

  return (
    <AuthLayout
      scene={sceneOf(problem, isOnline)}
      title={messages.title}
      subtitle={messages.subtitle}
      banner={<OfflineBanner />}
      notice={topNotice}
      footer={
        config.data?.isSignupEnabled && (
          <>
            {messages.noAccount}{' '}
            <TextLink render={<Link to="/signup" />}>{messages.createAccount}</TextLink>
          </>
        )
      }
    >
      <Form form={form} onSubmit={logInWith} className="flex flex-col gap-4">
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
        <FormField name="password" label={messages.password} isRequired>
          {(control) => <PasswordInput autoComplete="current-password" {...control} />}
        </FormField>
        <p className="-mt-2 flex justify-end">
          <TextLink render={<Link to="/forgot-password" state={{ email: typedEmail }} />}>
            {messages.forgotPassword}
          </TextLink>
        </p>
        {problem && problem.kind !== 'unverified' && (
          <Alert tone={isLimited ? 'warning' : 'danger'} isUrgent>
            {problem.message}
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <SubmitButton
            width="full"
            loadingLabel={messages.submitting}
            isBlocked={!isOnline}
            waitUntil={isLimited ? problem.retryAt : null}
            waitLabel={messages.retryIn}
          >
            {messages.submit}
          </SubmitButton>
          {isLimited && (
            <p className="text-center text-body-sm text-ink-muted">{messages.limitedHint}</p>
          )}
          {!isOnline && <p className="text-body-sm text-ink-muted">{messages.offlineHint}</p>}
        </div>
      </Form>
    </AuthLayout>
  )
}

function problemOf(error: unknown, email: string): LoginProblem {
  const message = errorMessageFor(error)
  if (!(error instanceof ApiError)) {
    return { kind: 'unexpected', message }
  }
  if (error.code === 'INVALID_CREDENTIALS') {
    return { kind: 'credentials', message }
  }
  if (error.code === 'EMAIL_NOT_VERIFIED') {
    return { kind: 'unverified', message, email }
  }
  if (error.code === 'TOO_MANY_ATTEMPTS') {
    return {
      kind: 'limited',
      message,
      retryAt: Date.now() + (error.retryAfterSeconds ?? 0) * MS_PER_SECOND,
    }
  }
  return { kind: 'unexpected', message }
}

function sceneOf(problem: LoginProblem | null, isOnline: boolean): OwlSceneName {
  if (!isOnline) {
    return 'offline'
  }
  if (problem?.kind === 'limited') {
    return 'wait'
  }
  return problem?.kind === 'unverified' ? 'envelope' : 'welcome'
}
