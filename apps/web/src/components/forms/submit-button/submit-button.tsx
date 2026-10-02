import { Button } from '@web/components/actions/button'
import type { SubmitButtonProps } from '@web/components/forms/submit-button/submit-button.types'
import { useFormContext, useFormState } from 'react-hook-form'

export function SubmitButton({
  requiresChange = false,
  isBlocked = false,
  ...props
}: SubmitButtonProps) {
  const { trigger } = useFormContext()
  const { isValid, isDirty, isSubmitting } = useFormState()
  const isIncomplete = !isValid || (requiresChange && !isDirty)

  return (
    <Button
      {...props}
      type="submit"
      isDisabled={isIncomplete || isBlocked}
      isLoading={isSubmitting}
      onDisabledPress={() => {
        if (!isBlocked) {
          void trigger(undefined, { shouldFocus: true })
        }
      }}
    />
  )
}
