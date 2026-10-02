import { emailRequestSchema } from '@financas/shared'
import { Alert } from '@web/components/feedback/alert'
import { Form } from '@web/components/forms/form'
import { FormField } from '@web/components/forms/form-field'
import { SubmitButton } from '@web/components/forms/submit-button'
import { TextInput } from '@web/components/inputs/text-input'
import { useResendVerification } from '@web/features/auth/api/use-resend-verification'
import { authMessages } from '@web/features/auth/auth.messages'
import type { FormProblem, ResendConfirmationFormProps } from '@web/features/auth/auth.types'
import { formProblemOf } from '@web/features/auth/components/form-problem'
import { useIsOnline } from '@web/hooks/use-is-online'
import { useSchemaForm } from '@web/lib/forms/use-schema-form'
import { useState } from 'react'

const messages = authMessages.verifyEmail.linkInvalid

export function ResendConfirmationForm({ onSent }: ResendConfirmationFormProps) {
  const isOnline = useIsOnline()
  const resend = useResendVerification()
  const [problem, setProblem] = useState<FormProblem | null>(null)
  const form = useSchemaForm({
    schema: emailRequestSchema,
    requiredMessages: messages.required,
    defaultValues: { email: '' },
  })

  async function resendTo({ email }: { email: string }) {
    setProblem(null)
    try {
      await resend.mutateAsync(email)
      onSent(email)
    } catch (error) {
      setProblem(formProblemOf(error))
    }
  }

  const isLimited = problem?.kind === 'limited'

  return (
    <Form form={form} onSubmit={resendTo} className="flex flex-col gap-3 text-left">
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
        variant="outline"
        width="full"
        loadingLabel={messages.resending}
        isBlocked={!isOnline}
        waitUntil={isLimited ? problem.retryAt : null}
        waitLabel={messages.retryIn}
      >
        {messages.resend}
      </SubmitButton>
    </Form>
  )
}
